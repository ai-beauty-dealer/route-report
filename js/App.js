document.addEventListener('DOMContentLoaded', () => {
    const reportForm = document.getElementById('reportForm');
    const cameraInput = document.getElementById('cameraInput');
    const previewContainer = document.getElementById('previewContainer');
    const submitBtn = document.getElementById('submitBtn');
    const loadingOverlay = document.getElementById('loadingOverlay');

    let processedImageData = null;
    let currentDay = '';

    const CUSTOMERS = {
        "Tuesday": ["フェイト", "スコップ", "スタンダード"],
        "Wednesday": ["リッシュヘアー", "ピーブランズヘア大野城", "ピーブランズヘア春日", "アリー", "スタイリー", "ベルリアージュ", "クレア", "リズム", "ワンネス", "ひとみ美容室", "プラント", "出張理美容", "アトリコ", "セブンベルベット", "コージーベルベット", "アヴェ", "スリー", "エレ", "ドロップバイドロップ", "ベルベット", "リコラ", "スタイリー"],
        "Thursday": ["リブロ", "ハルズヘアー", "ラック", "コージー", "ナッティー", "Pブランズ姪浜", "フイ", "ルテラ", "トルソー", "ヌーク", "シーサイド", "ククイ"],
        "Friday": ["リリー", "ホロホロヘアー", "サロンココ", "アンバー", "リュクス", "クラーク", "ミツアミ堂", "ラコヘアー", "ベルベット千早", "プレアー", "ストロベリー", "シエララグゼ", "ロブレ", "プアヒール"]
    };

    const dayBtns = document.querySelectorAll('.day-btn');
    const customerSelect = document.getElementById('storeName');
    const customerContainer = document.getElementById('customer-container');
    const customStoreContainer = document.getElementById('custom-store-container');
    const customStoreInput = document.getElementById('customStoreName');

    dayBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentDay = e.target.dataset.day;

            dayBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            customerSelect.innerHTML = '<option value="">サロンを選択してください</option>';
            CUSTOMERS[currentDay].forEach(name => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                customerSelect.appendChild(opt);
            });
            // 手入力オプションを追加
            const otherOpt = document.createElement('option');
            otherOpt.value = "other";
            otherOpt.textContent = "その他（直接入力）";
            customerSelect.appendChild(otherOpt);

            customerContainer.classList.add('visible');

            // リセット
            customStoreContainer.style.display = 'none';
            customStoreInput.removeAttribute('required');
            customStoreInput.value = '';
        });
    });

    // 「その他」が選ばれたらテキスト入力欄を表示
    customerSelect.addEventListener('change', (e) => {
        if (e.target.value === 'other') {
            customStoreContainer.style.display = 'block';
            customStoreInput.setAttribute('required', 'true');
        } else {
            customStoreContainer.style.display = 'none';
            customStoreInput.removeAttribute('required');
        }
    });

    // カメラボタンのクリック
    document.querySelector('.camera-btn').addEventListener('click', () => {
        cameraInput.click();
    });

    // 写真選択・撮影時の処理
    cameraInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // プレビュー表示
        const reader = new FileReader();
        reader.onload = (event) => {
            previewContainer.innerHTML = `<img src="${event.target.result}" class="preview-img" alt="Preview">`;
            processedImageData = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    // フォーム送信
    reportForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        let storeName = document.getElementById('storeName').value;
        if (storeName === 'other') {
            storeName = document.getElementById('customStoreName').value;
        }

        const reportText = document.getElementById('reportText').value;

        if (!currentDay || !storeName || !reportText) {
            alert('訪問曜日、得意先、報告内容は必須です。');
            return;
        }

        const data = {
            date: new Date().toLocaleDateString('ja-JP'), // For sheet tab name
            day: currentDay,
            customer: storeName,
            comment: reportText,
            image: processedImageData // Base64 (currently not handled by backend, but sent anyway)
        };

        // UI更新
        submitBtn.disabled = true;
        loadingOverlay.style.display = 'flex';

        try {
            const response = await fetch(Config.GAS_URL, {
                method: 'POST',
                mode: 'no-cors', // GASへのPOSTは CORS制約のため no-corsを指定することが多い
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            // no-corsの場合、レスポンスの内容は読めないが、エラーがなければ成功とみなす
            alert('報告が完了しました！');
            reportForm.reset();
            previewContainer.innerHTML = '';
            processedImageData = null;
            dayBtns.forEach(b => b.classList.remove('active'));
            customerContainer.classList.remove('visible');
            currentDay = '';

        } catch (error) {
            console.error('Error:', error);
            alert('送信に失敗しました。時間をおいて再度お試しください。');
        } finally {
            submitBtn.disabled = false;
            loadingOverlay.style.display = 'none';
        }
    });

    // PWA的なアプローチ：オフライン時の考慮（簡易版）
    window.addEventListener('offline', () => {
        alert('オフライン状態です。インターネットに接続してください。');
        submitBtn.disabled = true;
    });

    window.addEventListener('online', () => {
        submitBtn.disabled = false;
    });

    // 日報出力（LINE送信）ボタン
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            if (!currentDay) {
                statusMessage.innerHTML = '<span style="color: #ef4444;"><i class="bi bi-exclamation-triangle"></i> 先に曜日を選択してください</span>';
                return;
            }

            // 確認ダイアログ
            if (!confirm(`当日の日報データを出力して、LINEへ送信します。\nよろしいですか？`)) {
                return;
            }

            exportBtn.disabled = true;
            exportBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> 送信中...';
            statusMessage.innerHTML = '';

            const today = new Date();
            const dateStr = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;

            const payload = {
                action: 'exportReport',
                day: currentDay,
                date: dateStr
            };

            try {
                const response = await fetch(Config.GAS_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'text/plain;charset=utf-8',
                    },
                    body: JSON.stringify(payload)
                });

                statusMessage.innerHTML = '<span style="color: #10b981;"><i class="bi bi-check-circle"></i> LINEへ出力指示を送信しました！</span>';
            } catch (error) {
                console.error('Export Error:', error);
                statusMessage.innerHTML = '<span style="color: #ef4444;"><i class="bi bi-x-circle"></i> 送信に失敗しました。</span>';
            } finally {
                setTimeout(() => {
                    exportBtn.disabled = false;
                    exportBtn.innerHTML = '<i class="bi bi-file-earmark-spreadsheet"></i> 日報を出力（LINEへ送信）';
                }, 3000);
            }
        });
    }
});
