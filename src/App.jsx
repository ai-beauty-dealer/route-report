import React, { useState, useEffect } from 'react';

const DAYS = [
    { id: 'Monday', label: '月曜日' },
    { id: 'Tuesday', label: '火曜日' },
    { id: 'Wednesday', label: '水曜日' },
    { id: 'Thursday', label: '木曜日' },
    { id: 'Friday', label: '金曜日' },
];

const API_BASE_URL = 'https://release-electrical-pmid-houston.trycloudflare.com/api-report';

export default function App() {
    const [selectedDay, setSelectedDay] = useState('');
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [customStoreName, setCustomStoreName] = useState('');
    const [comment, setComment] = useState('');
    const [status, setStatus] = useState('idle'); // idle, loading, success, error
    const [customerMap, setCustomerMap] = useState({});

    // Export state
    const [exportDay, setExportDay] = useState('');
    const [exportDate, setExportDate] = useState('');
    const [exportStatus, setExportStatus] = useState('idle');
    const [exportMessage, setExportMessage] = useState('');

    // Voice state
    const [isRecording, setIsRecording] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [isProcessingVoice, setIsProcessingVoice] = useState(false);

    useEffect(() => {
        console.log('Fetching customers from:', `${API_BASE_URL}/customers`);
        fetch(`${API_BASE_URL}/customers`, {
            cache: 'no-store'
        })
            .then(res => {
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                return res.json();
            })
            .then(data => {
                console.log('Received customers data:', data);
                if (data && data.customers && typeof data.customers === 'object') {
                    setCustomerMap(data.customers);
                } else if (data && typeof data === 'object') {
                    setCustomerMap(data);
                } else {
                    console.error('Unexpected data format:', data);
                }
            })
            .catch(err => {
                console.error('Failed to fetch customers:', err);
                // Simple retry after 2 seconds
                setTimeout(() => {
                    fetch(`${API_BASE_URL}/customers`)
                        .then(res => res.json())
                        .then(data => {
                            if (data && data.customers) setCustomerMap(data.customers);
                            else setCustomerMap(data);
                        })
                        .catch(e => console.error('Retry failed:', e));
                }, 2000);
            });
    }, []);

    useEffect(() => {
        if (!selectedDay) {
            setCustomers([]);
            return;
        }

        // Case-insensitive lookup for the day key
        const dayKey = Object.keys(customerMap).find(k => k.toLowerCase() === selectedDay.toLowerCase());

        if (dayKey && customerMap[dayKey]) {
            console.log(`Setting customers for ${selectedDay} (keyed as ${dayKey})`);
            setCustomers(customerMap[dayKey]);
            setSelectedCustomer('');
            setCustomStoreName('');
        } else {
            console.log(`No customers found for ${selectedDay} in map keys:`, Object.keys(customerMap));
            setCustomers([]);
        }
    }, [selectedDay, customerMap]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            const chunks = [];

            recorder.ondataavailable = (e) => chunks.push(e.data);
            recorder.onstop = async () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                await processVoice(blob);
                stream.getTracks().forEach(track => track.stop());
            };

            recorder.start();
            setMediaRecorder(recorder);
            setIsRecording(true);
        } catch (err) {
            console.error('Failed to start recording:', err);
            alert('マイクの使用を許可してください。');
        }
    };

    const stopRecording = () => {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            setIsRecording(false);
        }
    };

    const processVoice = async (audioBlob) => {
        setIsProcessingVoice(true);
        const formData = new FormData();
        formData.append('audio', audioBlob, 'report.webm');

        try {
            const response = await fetch(`${API_BASE_URL}/voice-process`, {
                method: 'POST',
                headers: { 'ngrok-skip-browser-warning': 'true' },
                body: formData,
            });

            if (response.ok) {
                const data = await response.json();
                // We no longer extract or auto-select the customer from voice processing
                // based on user request. Only set the comment.
                if (data.comment) setComment(data.comment);
            } else {
                console.error('Voice processing failed');
            }
        } catch (error) {
            console.error('Error processing voice:', error);
        } finally {
            setIsProcessingVoice(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        let storeName = selectedCustomer;
        if (storeName === 'other') {
            storeName = customStoreName;
        }

        if (!selectedDay || !storeName || !comment) {
            alert('訪問曜日、得意先、報告内容は必須です。');
            return;
        }

        console.log(`Submitting report to: ${API_BASE_URL}/report`, { day: selectedDay, customer: storeName });

        try {
            const response = await fetch(`${API_BASE_URL}/report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    day: selectedDay,
                    customer: storeName,
                    comment,
                    date: new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })
                }),
            });

            if (response.ok) {
                setStatus('success');
                alert('報告が完了しました！');
                setComment('');
                setSelectedCustomer('');
                setCustomStoreName('');
                setSelectedDay('');
                setTimeout(() => setStatus('idle'), 1000);
            } else {
                setStatus('error');
                alert('送信に失敗しました。');
            }
        } catch (error) {
            setStatus('error');
            alert('通信エラーが発生しました。');
            setTimeout(() => setStatus('idle'), 1000);
        }
    };

    const handleExportToday = async () => {
        if (!selectedDay) {
            alert('先に曜日を選択してください');
            return;
        }

        if (!window.confirm(`当日の日報データを出力して、LINEへ送信します。よろしいですか？`)) {
            return;
        }

        setExportStatus('loading');
        try {
            console.log(`Exporting report to: ${API_BASE_URL}/report`, { action: 'exportReport', day: selectedDay });
            const response = await fetch(`${API_BASE_URL}/report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'exportReport',
                    day: selectedDay,
                    date: new Date().toLocaleDateString('ja-JP')
                }),
            });

            if (response.ok) {
                setExportStatus('success');
                alert('LINEへ出力指示を送信しました！');
            } else {
                setExportStatus('error');
                const errorData = await response.json().catch(() => ({}));
                alert(`送信に失敗しました。 (Status: ${response.status} ${errorData.error || ''})`);
            }
        } catch (error) {
            setExportStatus('error');
        } finally {
            setTimeout(() => setExportStatus('idle'), 3000);
        }
    };

    const handleExportPast = async () => {
        if (!exportDay || !exportDate) return;

        const d = new Date(exportDate);
        const dateStr = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;

        if (!window.confirm(`${exportDate} の日報データを出力してLINEへ送信します。\nよろしいですか？`)) {
            return;
        }

        setExportStatus('loading');
        try {
            const response = await fetch(`${API_BASE_URL}/report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'exportReport',
                    day: exportDay,
                    date: dateStr
                }),
            });

            if (response.ok) {
                setExportMessage('LINEへ出力指示を送信しました！');
            } else {
                setExportMessage('送信に失敗しました。');
            }
        } catch (error) {
            setExportMessage('エラーが発生しました。');
        } finally {
            setTimeout(() => {
                setExportStatus('idle');
                setExportMessage('');
            }, 3000);
        }
    };

    return (
        <div className="container">
            <header>
                <div className="brand-logo">ルート日報</div>
                <div className="brand-subtitle">Route Report Management</div>
            </header>

            <main className="card">
                <form id="reportForm" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label><i className="bi bi-calendar2-check"></i> 訪問曜日を選択</label>
                        <div className="day-grid">
                            {DAYS.map(day => (
                                <button
                                    key={day.id}
                                    type="button"
                                    className={`day-btn ${selectedDay === day.id ? 'active' : ''}`}
                                    onClick={() => setSelectedDay(day.id)}
                                >
                                    {day.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {selectedDay && (
                        <div className="form-group" id="customer-container">
                            <label htmlFor="storeName"><i className="bi bi-shop"></i> 得意先を選択</label>
                            <select
                                id="storeName"
                                value={selectedCustomer}
                                onChange={(e) => setSelectedCustomer(e.target.value)}
                                required
                            >
                                <option value="">サロンを選択してください</option>
                                {customers.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                                <option value="other">その他（直接入力）</option>
                            </select>
                        </div>
                    )}

                    {selectedCustomer === 'other' && (
                        <div className="form-group" id="custom-store-container">
                            <label htmlFor="customStoreName"><i className="bi bi-pencil-square"></i> サロン名を入力</label>
                            <input
                                type="text"
                                id="customStoreName"
                                value={customStoreName}
                                onChange={(e) => setCustomStoreName(e.target.value)}
                                placeholder="サロン名を手入力してください"
                                required
                            />
                        </div>
                    )}

                    {/* Voice Input Section (New addition to original UI) */}
                    <div className="form-group" style={{ textAlign: 'center', marginBottom: '16px' }}>
                        <button
                            type="button"
                            className={`premium-btn ${isRecording ? 'voice-pulse' : ''}`}
                            style={{
                                background: isRecording ? '#ef4444' : 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: isRecording ? '#fff' : 'var(--accent-blue)',
                                width: '100%'
                            }}
                            onClick={isRecording ? stopRecording : startRecording}
                        >
                            {isProcessingVoice ? (
                                <i className="bi bi-arrow-repeat spin"></i>
                            ) : isRecording ? (
                                <i className="bi bi-stop-circle"></i>
                            ) : (
                                <i className="bi bi-mic"></i>
                            )}
                            {isProcessingVoice ? ' AI解析中...' : isRecording ? ' 録音を停止' : ' 音声で報告内容を入力'}
                        </button>
                    </div>

                    <div className="form-group">
                        <label htmlFor="reportText"><i className="bi bi-chat-left-text"></i> 報告内容</label>
                        <textarea
                            id="reportText"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder={isProcessingVoice ? "AIが解析中..." : "活動内容・コメントを入力..."}
                            required
                        ></textarea>
                    </div>

                    <button type="submit" id="submitBtn" className="btn-submit" disabled={status === 'loading'}>
                        <span className="btn-text">{status === 'loading' ? '送信中...' : '報告を送信する'}</span>
                        <i className="bi bi-send btn-text"></i>
                    </button>
                </form>

                <hr style={{ border: 0, height: '1px', background: 'rgba(255,255,255,0.1)', margin: '2rem 0' }} />

                <div className="export-section" style={{ textAlign: 'center' }}>
                    <button
                        type="button"
                        id="exportBtn"
                        className="premium-btn"
                        style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', width: '100%' }}
                        onClick={handleExportToday}
                        disabled={exportStatus === 'loading'}
                    >
                        <i className="bi bi-file-earmark-spreadsheet"></i>
                        {exportStatus === 'loading' ? ' 送信中...' : ' 日報を出力（LINEへ送信）'}
                    </button>
                    <small style={{ color: 'rgba(255,255,255,0.6)', display: 'block', marginTop: '0.5rem' }}>
                        ※当日の日報をまとめて秘書からLINEへ送信します
                    </small>
                </div>

                <hr style={{ border: 0, height: '1px', background: 'rgba(255,255,255,0.1)', margin: '2rem 0' }} />

                {/* 過去日報出力セクション */}
                <div className="export-section">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: 'rgba(255,255,255,0.7)', marginBottom: '12px' }}>
                        <i className="bi bi-calendar2-range" style={{ color: '#f59e0b' }}></i> 過去日報出力
                    </label>
                    <small style={{ color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '12px' }}>
                        過去の日付を指定して日報をLINEに出力します
                    </small>
                    <div className="day-grid" id="export-day-grid" style={{ marginBottom: '12px' }}>
                        {DAYS.map(day => (
                            <button
                                key={`export-${day.id}`}
                                type="button"
                                className={`day-btn ${exportDay === day.id ? 'active' : ''}`}
                                style={exportDay === day.id ? { background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', border: 'none' } : {}}
                                onClick={() => setExportDay(day.id)}
                            >
                                {day.label}
                            </button>
                        ))}
                    </div>
                    {exportDay && (
                        <div id="export-date-container" style={{ marginBottom: '12px' }}>
                            <input
                                type="date"
                                id="exportDate"
                                value={exportDate}
                                onChange={(e) => setExportDate(e.target.value)}
                                style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '14px' }}
                                max={new Date().toISOString().split('T')[0]}
                            />
                        </div>
                    )}
                    <button
                        type="button"
                        id="exportPastBtn"
                        className="premium-btn"
                        disabled={exportStatus === 'loading' || !exportDay || !exportDate}
                        style={{
                            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                            width: '100%',
                            opacity: (exportStatus === 'loading' || !exportDay || !exportDate) ? 0.5 : 1
                        }}
                        onClick={handleExportPast}
                    >
                        <i className="bi bi-file-earmark-spreadsheet"></i>
                        {exportStatus === 'loading' ? ' 送信中...' : ' 過去日報を出力'}
                    </button>
                    {exportMessage && (
                        <div id="exportPastStatus" style={{ marginTop: '8px', textAlign: 'center', fontSize: '12px', color: '#10b981' }}>
                            {exportMessage}
                        </div>
                    )}
                </div>
            </main>

            {status === 'loading' && (
                <div id="loadingOverlay">
                    <div className="spinner"></div>
                    <p style={{ color: '#fff', fontWeight: 700 }}>送信中...</p>
                </div>
            )}

            <footer>
                &copy; 2026 2ND BRAIN SYSTEMS
            </footer>
        </div>
    );
}
