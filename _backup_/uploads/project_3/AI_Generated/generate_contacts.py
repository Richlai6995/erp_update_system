import pandas as pd

# 整理後的資料列表（已去除重複並合併資訊）
data = [
    {
        "姓名": "陈鸿垣",
        "英文姓名": "Felix Chen",
        "職稱": "协理 (Associate Vice President)",
        "公司": "翔威国际股份有限公司 (Shinewave)",
        "Email": "felixchen@shinewave.com",
        "手機": "(886) 961 220 061 / (86) 13771823864",
        "市話": "(886) 2 8662 1688 / (86) 512 6809 8292",
        "傳真": "(886) 2 8935 1999",
        "主要地址": "台北市116文山区罗斯福路六段218号10楼",
        "其他地址": "苏州市平江区人民路3188号万达广场C座1106室",
        "網站": "www.shinewave.com.cn"
    },
    {
        "姓名": "李國瑞",
        "英文姓名": "Jim Lee",
        "職稱": "店長",
        "公司": "崑碁電腦股份有限公司",
        "Email": "kunchin@ms24.hinet.net",
        "手機": "0939-751-580",
        "市話": "02-2392-9832",
        "傳真": "02-2356-3148",
        "主要地址": "台北市八德路一段41號",
        "其他地址": "分店: 台北市八德路一段54號; 市民大道三段2號/8號; 台中市西區英才路508號NOVA",
        "網站": "http://www.kunchi.com.tw"
    }
]

# 建立 DataFrame
df = pd.DataFrame(data)

# 設定檔案名稱
file_name = "contacts_summary.xlsx"

# 匯出成 Excel 檔案
# engine='openpyxl' 是為了確保支援 xlsx 格式
try:
    df.to_excel(file_name, index=False, engine='openpyxl')
    print(f"成功！檔案已建立為: {file_name}")
except ImportError:
    print("錯誤：請先安裝 openpyxl 套件。執行指令: pip install openpyxl")
except Exception as e:
    print(f"發生錯誤: {e}")