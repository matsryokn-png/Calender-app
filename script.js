// --- 設定項目 ---
// ★★★ 必ずご自身のクライアントIDに書き換えてください ★★★
const CLIENT_ID = '544762753340-373go1cd90b4s5af8rkl7tdvcb3f3vb8.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

// --- グローバル変数 ---
let tokenClient;
let gapiInited = false;
let gisInited = false;
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();

// --- DOM要素 ---
const authContainer = document.getElementById('auth-container');
const calendarContainer = document.getElementById('calendar-container');
const statusElement = document.getElementById('status');
const calendarDiv = document.getElementById('calendar');
const calendarTitle = document.getElementById('calendar-title');
const prevMonthButton = document.getElementById('prev-month');
const nextMonthButton = document.getElementById('next-month');

// --- 初期化処理 ---

window.onload = function() {
    // 1. Google Identity Services (GIS) の初期化
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: handleTokenResponse, // トークン取得後のコールバック
    });
    gisInited = true;
    attemptSilentLogin(); // ★★★ 変更点：まずサイレント認証を試みる

    // 2. Google Calendar API (gapi) の初期化
    gapi.load('client', initializeGapiClient);
};

async function initializeGapiClient() {
    await gapi.client.init({
        discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"],
    });
    gapiInited = true;
    attemptSilentLogin(); // ★★★ 変更点：gapiの準備完了後にも確認
}

// ★★★ 追加点：サイレント認証を試みる関数 ★★★
function attemptSilentLogin() {
    // gapiとgisの両方が初期化されていないと実行しない
    if (gapiInited && gisInited) {
        // prompt: '' を指定すると、ポップアップなしで認証を試みる
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

// --- 認証フローのUI制御 ---

// 認証成功時のUIを表示
function showAuthenticatedUI() {
    authContainer.innerHTML = ''; // 認証ボタンを消去
    const signoutButton = document.createElement('button');
    signoutButton.textContent = 'サインアウト';
    signoutButton.id = 'signout_button';
    signoutButton.onclick = handleSignout;
    authContainer.appendChild(signoutButton);

    calendarContainer.style.display = 'block'; // カレンダーを表示
    statusElement.textContent = '認証済みです。日付を選択してください。';
    renderCalendar();
}

// 未認証時のUIを表示（認証ボタン）
function showUnauthenticatedUI() {
    authContainer.innerHTML = ''; // コンテナをクリア
    const authButton = document.createElement('button');
    authButton.textContent = 'Googleアカウントで認証';
    authButton.onclick = () => {
        // ユーザーがクリックした場合は、ポップアップを表示して認証
        tokenClient.requestAccessToken({ prompt: 'consent' });
    };
    authContainer.appendChild(authButton);

    calendarContainer.style.display = 'none'; // カレンダーを非表示
    statusElement.textContent = 'Googleアカウントで認証してください。';
}

// サインアウト処理
function handleSignout() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token, () => {
            gapi.client.setToken('');
            showUnauthenticatedUI();
        });
    }
}

// 認証トークン取得後のメイン処理
function handleTokenResponse(tokenResponse) {
    // ★★★ 変更点：エラーがあるか、アクセストークンがない場合は未認証UIを表示 ★★★
    if (tokenResponse.error || !tokenResponse.access_token) {
        // サイレント認証が失敗した場合、ユーザーに手動認証を促す
        showUnauthenticatedUI();
        return;
    }
    // 成功した場合、認証済みUIを表示
    showAuthenticatedUI();
}

// (以下、カレンダー処理の関数は変更ありません)
// --- カレンダー処理 ---

function renderCalendar() {
    calendarDiv.innerHTML = '';
    const date = new Date(currentYear, currentMonth, 1);
    const monthName = date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' });
    calendarTitle.textContent = monthName;

    const firstDay = date.getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    ['日', '月', '火', '水', '木', '金', '土'].forEach(day => {
        const weekdayCell = document.createElement('div');
        weekdayCell.classList.add('weekday');
        weekdayCell.textContent = day;
        calendarDiv.appendChild(weekdayCell);
    });

    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.classList.add('day', 'empty');
        calendarDiv.appendChild(emptyCell);
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const dayCell = document.createElement('div');
        dayCell.classList.add('day');
        dayCell.textContent = i;

        const yearStr = currentYear;
        const monthStr = String(currentMonth + 1).padStart(2, '0');
        const dayStr = String(i).padStart(2, '0');
        dayCell.dataset.date = `${yearStr}-${monthStr}-${dayStr}`;
        
        dayCell.onclick = handleDateClick;
        calendarDiv.appendChild(dayCell);
    }
}

function handleDateClick(event) {
    const selectedDate = event.target.dataset.date;
    addWorkShift(selectedDate);
}

async function addWorkShift(dateString) {
    statusElement.textContent = `${dateString} に予定を追加中...`;
    try {
        const event = {
            'summary': 'バイト',
            'description': '自動で追加されたバイトの予定です。',
            'start': { 'dateTime': `${dateString}T09:00:00`, 'timeZone': 'Asia/Tokyo' },
            'end': { 'dateTime': `${dateString}T20:00:00`, 'timeZone': 'Asia/Tokyo' },
            'colorId': '4' 
        };
        const response = await gapi.client.calendar.events.insert({
            'calendarId': 'primary',
            'resource': event
        });
        statusElement.innerHTML = `✅ 成功！ <a href="${response.result.htmlLink}" target="_blank">カレンダーで予定を確認</a>`;
    } catch (error) {
        console.error("APIからのエラー:", error);
        statusElement.textContent = '❌ エラー: 予定の追加に失敗しました。';
    }
}

prevMonthButton.onclick = () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
};

nextMonthButton.onclick = () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
};