function doGet(e) {
    var params = e ? e.parameter : {};

    // --- CRM連携: サロン別日報取得API ---
    if (params.action === 'getReports') {
        var customerName = params.customer || '';
        var day = params.day || '';

        var ssMap = {
            "Tuesday": "2026火曜日ルート日報",
            "Wednesday": "2026水曜日ルート日報",
            "Thursday": "2026木曜日ルート日報",
            "Friday": "2026金曜日ルート日報"
        };

        var reports = [];

        // 指定曜日のスプレッドシートを検索
        var fileName = ssMap[day];
        if (!fileName) {
            return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid day' }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        var files = DriveApp.getFilesByName(fileName);
        if (!files.hasNext()) {
            return ContentService.createTextOutput(JSON.stringify({ status: 'ok', reports: [] }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        var ss = SpreadsheetApp.open(files.next());
        var sheets = ss.getSheets();

        for (var i = 0; i < sheets.length; i++) {
            var sheet = sheets[i];
            var sheetName = sheet.getName(); // 日付 (e.g., "2026/2/18")
            var lastRow = sheet.getLastRow();
            if (lastRow <= 1) continue; // ヘッダーのみ

            var lastCol = Math.max(4, sheet.getLastColumn());
            var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
            for (var j = 0; j < data.length; j++) {
                // 列構造: A=件数, B=サロン名, C=コメント, D=写真URL
                var salonName = String(data[j][1]).trim();
                var comment = String(data[j][2]).trim();
                var photoUrl = data[j].length > 3 ? String(data[j][3]) : '';

                if (!salonName || !comment) continue;
                if (customerName && salonName !== customerName) continue;

                reports.push({
                    date: sheetName,
                    salon: salonName,
                    comment: comment,
                    photoUrl: photoUrl
                });
            }
        }

        // 日付降順でソート
        reports.sort(function (a, b) {
            return b.date.localeCompare(a.date);
        });

        var output = JSON.stringify({ status: 'ok', reports: reports });

        // JSONP対応
        if (params.callback) {
            return ContentService.createTextOutput(params.callback + '(' + output + ')')
                .setMimeType(ContentService.MimeType.JAVASCRIPT);
        }

        return ContentService.createTextOutput(output)
            .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
}

function testAuth() {
    // この関数はGoogleの権限許可（UrlFetchApp）をポップアップさせるためのテスト用です。
    // エディタからこの関数を選択して「実行」してください。
    var response = UrlFetchApp.fetch("https://www.google.com");
    Logger.log(response.getResponseCode());
}

function doPost(e) {
    var data = JSON.parse(e.postData.contents);
    var day = data.day; // "Tuesday", "Wednesday", etc.
    var customer = data.customer;
    var comment = data.comment;
    var dateStr = data.date; // e.g., "2026/2/20"

    // Mapping day to Spreadsheet name
    var ssMap = {
        "Tuesday": "2026火曜日ルート日報",
        "Wednesday": "2026水曜日ルート日報",
        "Thursday": "2026木曜日ルート日報",
        "Friday": "2026金曜日ルート日報"
    };

    var fileName = ssMap[day];
    var files = DriveApp.getFilesByName(fileName);

    if (!files.hasNext()) {
        return ContentService.createTextOutput("File not found: " + fileName).setMimeType(ContentService.MimeType.TEXT);
    }

    var ss = SpreadsheetApp.open(files.next());
    var sheetName = dateStr;
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
        // Create new sheet for the date if it doesn't exist
        sheet = ss.insertSheet(sheetName);
        sheet.appendRow(["件数", "サロン名", "コメント", "写真URL"]);
        // Apply formatting
        sheet.getRange("A1:D1").setBackground("#f3f3f3").setFontWeight("bold");
    }

    // --- 日報出力処理 (Export Report to LINE) ---
    if (data.action === 'exportReport') {
        // 1. 表のフォーマットを見やすく調整する
        var lastRow = sheet.getLastRow();
        var lastCol = Math.max(1, sheet.getLastColumn());
        if (lastRow > 0 && lastCol > 0) {
            var fullRange = sheet.getRange(1, 1, lastRow, lastCol);

            // 罫線を引く
            fullRange.setBorder(true, true, true, true, true, true);

            // 列幅の自動調整 (D列のURLが長すぎる場合はA,B,C列のみ調整)
            for (var i = 1; i <= 3; i++) {
                sheet.autoResizeColumn(i);
            }
            sheet.setColumnWidth(4, 200); // URL列は固定幅

            // 改行を許可して上揃え
            fullRange.setWrap(true);
            fullRange.setVerticalAlignment("top");
        }

        // 2. データの抽出
        var dataValues = [];
        if (lastRow > 1) {
            dataValues = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
        }

        // 3. LINE秘書サーバー (Cloudflare URL) へWebhook送信
        var props = PropertiesService.getScriptProperties();
        var lineServerUrl = props.getProperty('LINE_SERVER_URL') || 'https://release-electrical-pmid-houston.trycloudflare.com';
        lineServerUrl = lineServerUrl.replace(/\/$/, '') + '/send-route-report';
        var payloadForLine = {
            date: dateStr,
            day: day,
            records: dataValues
        };

        var options = {
            'method': 'post',
            'contentType': 'application/json',
            'headers': {
                'ngrok-skip-browser-warning': 'true'
            },
            'payload': JSON.stringify(payloadForLine),
            'muteHttpExceptions': true
        };

        try {
            UrlFetchApp.fetch(lineServerUrl, options);
        } catch (err) {
            return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Failed to send to LINE server: " + err.message })).setMimeType(ContentService.MimeType.JSON);
        }

        return ContentService.createTextOutput(JSON.stringify({ status: "export_success" })).setMimeType(ContentService.MimeType.JSON);
    }
    // ----------------------------------------


    // --- 通常の日報追加処理 (Append Report) ---
    // Handle image if present
    var imageUrl = "";
    if (data.image) {
        try {
            // "data:image/jpeg;base64,..." をパース
            var mimeType = data.image.split(';')[0].replace('data:', '');
            var base64Data = data.image.split(',')[1];
            var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, customer + "_" + new Date().getTime() + ".jpg");

            // 保存先フォルダの取得（なければ作成）
            var folderName = "2026_Route_Photos";
            var folders = DriveApp.getFoldersByName(folderName);
            var folder;
            if (folders.hasNext()) {
                folder = folders.next();
            } else {
                folder = DriveApp.createFolder(folderName);
            }

            // ファイル作成とURL取得
            var file = folder.createFile(blob);
            imageUrl = file.getUrl();
        } catch (e) {
            imageUrl = "Error saving image: " + e.message;
        }
    }

    var lastRow = sheet.getLastRow();
    var count = lastRow; // Since row 1 is header
    sheet.appendRow([count, customer, comment, imageUrl]);

    return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
}
