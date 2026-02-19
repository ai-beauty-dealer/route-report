document.addEventListener('DOMContentLoaded', () => {
    const reportForm = document.getElementById('reportForm');
    const cameraInput = document.getElementById('cameraInput');
    const previewContainer = document.getElementById('previewContainer');
    const submitBtn = document.getElementById('submitBtn');
    const loadingOverlay = document.getElementById('loadingOverlay');

    let processedImageData = null;

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

        if (!storeName || !reportText) {
            alert('店名と報告内容は必須です。');
            return;
        }

        const data = {
            timestamp: new Date().toISOString(),
            storeName,
            reportText,
            image: processedImageData // Base64
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
