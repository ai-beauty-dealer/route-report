import os
import json
import requests
from datetime import datetime, timedelta
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
genai.configure(api_key=GEMINI_API_KEY)

def get_weekly_reports():
    # In a real environment, we would fetch from the backend API.
    # For now, we'll try to read from the local Report_Sync.md or a similar source if available.
    # But since the goal is a "Strategic Report", we assume we have a way to get the last 7 days.
    
    # Mocking data fetch from the backend
    try:
        # Note: In the user's system, reports are stored in a database via a node/express backend.
        # We'll assume there's an endpoint or we can read the Markdown logs.
        # Let's check the local 05_日誌 files for the last 7 days.
        reports = []
        for i in range(7):
            date = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
            file_path = f"/Users/bunchaca/product/2nd-Brain/05_日誌/{date}.md"
            if os.path.exists(file_path):
                with open(file_path, 'r') as f:
                    content = f.read()
                    # Simple extraction of report sections
                    if "報告" in content or "日報" in content:
                        reports.append({"date": date, "content": content})
        return reports
    except Exception as e:
        print(f"Error fetching logs: {e}")
        return []

def generate_strategic_report():
    reports = get_weekly_reports()
    if not reports:
        return "直近1週間の日報データが見つかりませんでした。"

    prompt = f"""
あなたはユーザー（ぶんちゃん）の戦略担当秘書です。
今週の全日報データ（以下）を分析し、来週の戦略を立案してください。

【今週の日報データ】
{json.dumps(reports, ensure_ascii=False, indent=2)}

【分析のポイント】
1. 好調な商材・トピックの特定
2. 課題や拒絶反応のあったパターンの抽出
3. 現場の小さな変化（兆候）の発見
4. 来週集中すべき「一手の提案」

プレミアムなビジネスレポート形式（日本語・広島弁の添え書きあり）で作成してください。
"""

    model = genai.GenerativeModel('gemini-2.0-flash-exp')
    response = model.generate_content(prompt)
    
    report_content = response.text
    
    # Save the report to 99_Sbox
    report_date = datetime.now().strftime("%Y%m%d")
    output_path = f"/Users/bunchaca/product/2nd-Brain/99_Sbox/Weekly_Strategic_Report_{report_date}.md"
    
    with open(output_path, 'w') as f:
        f.write(f"# Weekly Strategic Report ({report_date})\n\n")
        f.write(report_content)
    
    return f"✅ 戦略レポートを生成して {output_path} に保存したよ！"

if __name__ == "__main__":
    print(generate_strategic_report())
