document.addEventListener('DOMContentLoaded', () => {
    const reportForm = document.getElementById('reportForm');
    const cameraInput = document.getElementById('cameraInput');
    const previewContainer = document.getElementById('previewContainer');
    const submitBtn = document.getElementById('submitBtn');
    const loadingOverlay = document.getElementById('loadingOverlay');

    let processedImageData = null;
    let currentDay = '';

    const CUSTOMERS = {
        "Tuesday": ["FATE", "スコップ", "スタンダード"],
        "Wednesday": ["リッシュヘアー", "ピーブランズヘア大野城", "ピーブランズヘア春日", "アリー", "スタイリー", "ベルリアージュ", "クレア", "リズム", "ひとみ美容室", "プラント", "出張理美容", "アトリコ", "7ベルベット", "コージーベルベット", "AVE", "THREE", "ere", "Drop by drop", "ベルベット", "リコラ", "ワンネス"],
        "Thursday": ["リブロ", "HALS hair place", "luck", "KOZY", "クプラ", "NATTY", "Pブランズ姪浜", "Hui", "ルテラ", "トルソー", "nook", "シーサイド"],
        "Friday": ["Lilly", "ホロホロヘアー", "Salon COCO", "Amber.", "Luxe", "クラーク", "ミツアミ堂", "LACO hair", "ベルベット千早", "プレアー", "ストロベリー"]
    };

    const dayBtns = document.querySelectorAll('.day-btn');
    const customerSelect = document.getElementById('storeName');
    const customerContainer = document.getElementById('customer-container');

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

            customerContainer.classList.add('visible');
        });
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

        const storeName = document.getElementById('storeName').value;
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
});
