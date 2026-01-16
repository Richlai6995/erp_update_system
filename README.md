# 正崴雲端智慧發信系統 (Foxlink Cloud Smart Mailing System)

本專案是一個整合了 **檔案管理**、**自動化文件生成**、**智慧郵件發送** 與 **AI 輔助** 的企業級網頁應用程式。系統採用前後端分離架構，並支援 Docker 容器化部署，適合用於企業內部的專案文件管理與自動化通知流程。

---

## 🌟 主要功能 (Key Features)

### 1. 專案與檔案管理
*   **專案結構化**：支援多層級專案資料夾管理，並可綁定 Google Drive 或本地儲存空間。
*   **檔案同步**：支援與 Google Drive 雙向同步 (需設定 Drive API)，或是純本地檔案系統管理。
*   **權限控管**：基於角色的權限管理 (RBAC)，支援專案成員與管理員分級。

### 2. 智慧發信與排程 (Smart Mailing)
*   **文件範本**：內建強大的範本編輯器，支援動態變數插入 (如日期、專案名稱)。
*   **自動化排程**：可設定 Cron Job 定時生成文件並發送郵件 (日/週/月報表自動化)。
*   **HTML/PDF/Word 生成**：支援將範本轉換為標準格式發送。

### 3. AI 智能輔助 (Integrated AI)
*   **名片辨識**：整合 **Google Gemini API**，上傳名片即可自動辨識姓名、職稱、Email 等資訊並建檔。
*   **內容生成**：AI 輔助撰寫郵件內容或摘要。

### 4. 系統安全與維護
*   **LDAP 整合**：支援企業 AD (Active Directory) 帳號整合登入。
*   **資料庫備份**：內建自動化備份機制，支援定期備份至指定 Server 路徑，並提供介面一鍵還原。
*   **日誌管理**：自動記錄所有發信紀錄，並具備自動清除機制 (Auto Cleanup) 以維護效能。

---

## 🛠️ 技術架構 (Tech Stack)

*   **Frontend**: React, TypeScript, Tailwind CSS, Vite
*   **Backend**: Node.js, Express
*   **Database**: SQLite (輕量化、易於備份與遷移)
*   **Infrastructure**: Docker, Docker Compose
*   **AI Service**: Google Gemini Pro/Flash
*   **Authentication**: Custom JWT + LDAP (Optional)

---

## 🚀 Docker 部署指南 (Deployment)

本系統建議使用 Docker Compose 進行部署，以確保環境一致性。

### 1. 環境準備
請確保伺服器已安裝：
*   Docker Engine
*   Docker Compose

### 2. 設定環境變數
在專案根目錄 (或 `server/`) 建立 `.env` 檔案，填入以下關鍵設定：

```env
# Server Configuration
PORT=3002
NODE_ENV=production

# Security
JWT_SECRET=your_super_secure_secret_key

# LDAP Configuration (Optional, if using AD)
LDAP_URL=ldap://192.168.x.x
LDAP_BASE_DN=dc=example,dc=com
LDAP_ADMIN_DN=cn=admin,dc=example,dc=com
LDAP_ADMIN_PASSWORD=your_ldap_password

# Google Gemini AI (Required for AI features)
GEMINI_API_KEY=your_gemini_api_key

# Email Server (SMTP)
SMTP_SERVER=smtp.example.com
SMTP_PORT=25
SMTP_USERNAME=your_username
SMTP_PASSWORD=your_password
FROM_ADDRESS=system@example.com

# System Paths (For Docker internal use)
DB_PATH=/app/data/system.db
FILES_ROOT_DIR=/app/local_storage
```

> **注意**：`server/config/system.yaml` 可額外設定備份路徑，請確保該檔案存在或讓系統自動生成。

### 3. Docker Compose 啟動
執行以下指令來建置並啟動服務：

```bash
docker-compose up -d --build
```

### 4. 資料持久化 (Volumes)
為了確保資料不會因容器重啟而遺失，`docker-compose.yml` 已預設掛載以下 Volume，請根據實際伺服器路徑修改：

- `data`: 存放 SQLite 資料庫 (`system.db`)
- `local_storage`: 存放上傳的實體檔案
- `logs`: 存放系統運作日誌
- `backups`: 存放自動備份檔

**範例 docker-compose.yml 片段：**
```yaml
volumes:
  - /mnt/e/file_managerment_container/data:/app/data
  - /mnt/e/file_managerment_container/files:/app/local_storage
  - /mnt/e/backup_file:/app/backups
```

---

## 📖 使用手冊
詳細操作與維護說明，請參考系統內的線上文件或 `docs/` 資料夾：
*   [使用者手冊 (USER_MANUAL.md)](./docs/USER_MANUAL.md)
*   [系統管理員手冊 (ADMIN_MANUAL.md)](./docs/ADMIN_MANUAL.md)

---

## ⚠️ 注意事項

1.  **時區問題**：Docker 容器預設為 UTC，建議在 `docker-compose.yml` 中設定 `TZ=Asia/Taipei` 以確保排程與日誌時間正確。
2.  **檔案權限**：請確保宿主機 (Host) 掛載的資料夾具有讀寫權限，避免 Node.js 無法寫入檔案。
3.  **備份路徑**：若修改了備份路徑，請同步更新前端顯示設定 (`backup_display_path`)，以免介面顯示路徑與實際不符。

---

© 2026 Foxlink. All Rights Reserved.
