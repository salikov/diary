// ==UserScript==
// @name         Дневник: Аналитика оценок
// @namespace    https://diary.e-schools.by/userscripts/analytics
// @version      0.1.4
// @description  Показывает оценки и средний балл по четвертям в дневнике
// @match        https://diary.e-schools.by/*
// @include      https://diary.e-schools.by/*
// @updateURL    https://raw.githubusercontent.com/salikov/diary/refs/heads/main/diary-analytics.user.js
// @downloadURL  https://raw.githubusercontent.com/salikov/diary/refs/heads/main/diary-analytics.user.js
// @noframes
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const ROOT_ID = 'diary-analytics-userscript';
  const API = '/api/v1';
  const TIME_ZONE = 'Europe/Minsk';
  const QUARTER_NAMES = ['I четверть', 'II четверть', 'III четверть', 'IV четверть'];
  const STUDENT_KEY = 'diaryAnalyticsStudentId';
  const QUARTER_KEY = 'diaryAnalyticsQuarter';

  if (document.getElementById(ROOT_ID)) return;

  const root = document.createElement('div');
  root.id = ROOT_ID;
  document.documentElement.append(root);
  const shadow = root.attachShadow({ mode: 'open' });

  shadow.innerHTML = `
    <style>
      :host {
        all: initial; position: fixed; inset: 0; z-index: 2147483647;
        display: block; pointer-events: none;
      }
      * { box-sizing: border-box; }
      .launcher {
        position: fixed; z-index: 2147483646; right: 20px; bottom: 20px;
        min-height: 48px; padding: 0 17px; border: 0; border-radius: 15px;
        background: #2563eb; color: #fff; box-shadow: 0 8px 26px #173b7a40;
        font: 650 14px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        cursor: pointer; pointer-events: auto;
      }
      .launcher:hover { background: #1d4ed8; }
      .panel {
        position: fixed; z-index: 2147483647; inset: 50% auto auto 50%;
        display: flex; flex-direction: column; width: min(760px, calc(100vw - 28px));
        max-height: min(820px, calc(100vh - 32px)); overflow: hidden;
        transform: translate(-50%, -50%); border: 1px solid #e2e8f0; border-radius: 22px;
        background: #f4f7fb; color: #172033;
        box-shadow: 0 24px 90px #0f172a55;
        font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        pointer-events: auto;
      }
      .panel[hidden] { display: none; }
      .header { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 14px; padding: 18px 20px; background: #fff; }
      .heading { min-width: 0; }
      .title { margin: 0; color: #15213a; font-size: 19px; font-weight: 750; letter-spacing: -.03em; }
      .subtitle { margin: 3px 0 0; color: #6b778c; font-size: 12px; }
      .header-actions { display: flex; gap: 8px; }
      button, select { font: inherit; }
      button { cursor: pointer; }
      .icon-button { display: grid; width: 40px; height: 40px; place-items: center; border: 1px solid #e5eaf2; border-radius: 12px; background: #fff; color: #526078; }
      .icon-button:hover { background: #f4f7fb; }
      .icon-button svg { width: 18px; height: 18px; }
      .content { overflow: auto; padding: 16px; }
      .controls { display: grid; grid-template-columns: 1fr 1fr; gap: 11px; padding: 14px; border: 1px solid #e6ebf3; border-radius: 16px; background: #fff; }
      .field { display: grid; min-width: 0; gap: 6px; }
      .field[hidden] { display: none; }
      .field label { color: #69768a; font-size: 11px; font-weight: 700; }
      select { width: 100%; min-height: 43px; padding: 0 11px; border: 1px solid #e2e8f0; border-radius: 11px; outline: none; background: #fff; color: #1c2940; }
      select:focus { border-color: #76a0f5; box-shadow: 0 0 0 3px #3b82f61a; }
      .summary { display: grid; grid-template-columns: 1fr 1fr; gap: 11px; margin: 11px 0; }
      .metric { padding: 13px 15px; border: 1px solid #e6ebf3; border-radius: 15px; background: #fff; }
      .metric-label, .metric-note { display: block; color: #69768a; font-size: 11px; }
      .metric-value { display: block; margin: 3px 0; color: #172033; font-size: 23px; font-weight: 760; letter-spacing: -.04em; }
      .results { overflow: hidden; border: 1px solid #e6ebf3; border-radius: 16px; background: #fff; }
      .results-title { margin: 0; padding: 15px 16px 12px; font-size: 15px; font-weight: 720; }
      .state { display: grid; min-height: 130px; place-items: center; padding: 24px; color: #69768a; text-align: center; }
      .state[hidden] { display: none; }
      .state p { max-width: 390px; margin: 0; font-size: 13px; line-height: 1.55; }
      .state strong { display: block; margin-bottom: 5px; color: #27344a; font-size: 14px; }
      .spinner { width: 23px; height: 23px; margin: 0 auto 11px; border: 3px solid #dbe7ff; border-top-color: #2563eb; border-radius: 50%; animation: spin .8s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }
      .table-wrap { overflow-x: auto; }
      .table-wrap[hidden] { display: none; }
      table { width: 100%; border-collapse: collapse; text-align: left; }
      th { padding: 10px 14px; border-top: 1px solid #eef1f5; border-bottom: 1px solid #eef1f5; background: #fafbfd; color: #69768a; font-size: 10px; font-weight: 700; }
      td { padding: 12px 14px; border-bottom: 1px solid #eef1f5; vertical-align: top; font-size: 12px; }
      tbody tr:last-child td { border-bottom: 0; }
      .subject { min-width: 145px; font-weight: 680; line-height: 1.4; }
      .grades { display: flex; flex-wrap: wrap; min-width: 120px; gap: 5px; }
      .grade { display: inline-flex; min-height: 24px; align-items: center; padding: 3px 7px; border-radius: 7px; background: #eff4ff; color: #254b91; font-size: 11px; white-space: nowrap; }
      .average { display: inline-flex; min-width: 45px; justify-content: center; padding: 5px 7px; border-radius: 8px; font-size: 11px; font-weight: 750; }
      .average-green { background: #e9f8ef; color: #138044; }
      .average-yellow { background: #fff6da; color: #946900; }
      .average-red { background: #fff0ee; color: #bd4031; }
      .average-empty { background: #f1f3f6; color: #7b8492; }
      .footer { padding: 10px 16px 13px; color: #8993a3; font-size: 10px; }
      @media (max-width: 560px) {
        .launcher { right: 12px; bottom: 12px; }
        .panel { width: calc(100vw - 16px); max-height: calc(100vh - 16px); border-radius: 17px; }
        .header { padding: 14px; }
        .content { padding: 10px; }
        .controls { padding: 11px; gap: 9px; }
        .results-title { padding: 13px 12px 10px; }
        th, td { padding-right: 10px; padding-left: 10px; }
        .subject { min-width: 125px; }
      }
      @media (max-width: 360px) { .controls { grid-template-columns: 1fr; } }
      @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; } }
    </style>
    <button class="launcher" type="button">Аналитика оценок</button>
    <section class="panel" aria-label="Аналитика оценок" hidden>
      <header class="header">
        <div class="heading">
          <h1 class="title">Дневник: Аналитика</h1>
          <p class="subtitle">Оценки и средний балл за четверть</p>
        </div>
        <div class="header-actions">
          <button class="icon-button refresh" type="button" aria-label="Обновить данные" title="Обновить данные">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5m10.2-2A7.5 7.5 0 0 0 6.1 6.3L4 8m16 8-2.1 1.7A7.5 7.5 0 0 1 4.8 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="icon-button close" type="button" aria-label="Закрыть" title="Закрыть">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
        </div>
      </header>
      <div class="content">
        <div class="controls">
          <div class="field student-field" hidden>
            <label for="student">Ученик</label>
            <select id="student" aria-label="Выберите ученика"></select>
          </div>
          <div class="field quarter-field">
            <label for="quarter">Четверть</label>
            <select id="quarter" aria-label="Выберите четверть"></select>
          </div>
        </div>
        <div class="summary" aria-live="polite">
          <article class="metric">
            <span class="metric-label">Средний балл</span>
            <strong class="metric-value overall">—</strong>
            <span class="metric-note overall-note">по числовым оценкам</span>
          </article>
          <article class="metric">
            <span class="metric-label">Предметы</span>
            <strong class="metric-value subject-count">—</strong>
            <span class="metric-note grade-count">оценок: —</span>
          </article>
        </div>
        <section class="results" aria-label="Успеваемость">
          <h2 class="results-title">Успеваемость</h2>
          <div class="state" role="status" aria-live="polite"></div>
          <div class="table-wrap" hidden>
            <table>
              <thead><tr><th>Предмет</th><th>Оценки</th><th>Средний балл</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
          <p class="footer">Числовые оценки учитываются в среднем балле. Остальные показываются отдельно.</p>
        </section>
      </div>
    </section>
  `;

  const ui = {
    launcher: shadow.querySelector('.launcher'),
    panel: shadow.querySelector('.panel'),
    close: shadow.querySelector('.close'),
    refresh: shadow.querySelector('.refresh'),
    studentField: shadow.querySelector('.student-field'),
    student: shadow.querySelector('#student'),
    quarter: shadow.querySelector('#quarter'),
    state: shadow.querySelector('.state'),
    tableWrap: shadow.querySelector('.table-wrap'),
    tbody: shadow.querySelector('tbody'),
    overall: shadow.querySelector('.overall'),
    overallNote: shadow.querySelector('.overall-note'),
    subjectCount: shadow.querySelector('.subject-count'),
    gradeCount: shadow.querySelector('.grade-count')
  };

  let authToken = null;
  let loadSequence = 0;
  let quarterIndex = getSavedQuarter();

  function getSavedQuarter() {
    const savedValue = localStorage.getItem(QUARTER_KEY);
    if (savedValue === null) return getCurrentQuarter(minskDateParts());
    const value = Number(savedValue);
    return Number.isInteger(value) && value >= 0 && value <= 3 ? value : getCurrentQuarter(minskDateParts());
  }

  function minskDateParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
  }

  function getCurrentQuarter(parts) {
    if (parts.month <= 10 && parts.month >= 9) return 0;
    if (parts.month <= 12 && parts.month >= 11) return 1;
    if (parts.month <= 3) return 2;
    return 3;
  }

  function getSchoolYear(parts) {
    return parts.month >= 9 ? parts.year : parts.year - 1;
  }

  function getQuarterDates(index, year) {
    return [
      { start: `${year}-09-01`, end: `${year}-10-31` },
      { start: `${year}-11-01`, end: `${year}-12-31` },
      { start: `${year + 1}-01-01`, end: `${year + 1}-03-31` },
      { start: `${year + 1}-04-01`, end: `${year + 1}-05-31` }
    ][index];
  }

  function formatApiDate(isoDate) {
    const [year, month, day] = isoDate.split('-');
    return `${day}.${month}.${year}`;
  }

  function addDays(isoDate, count) {
    const date = new Date(`${isoDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + count);
    return date.toISOString().slice(0, 10);
  }

  function makeDateChunks(dates) {
    const chunks = [];
    let start = dates.start;
    while (start <= dates.end) {
      const end = [addDays(start, 6), dates.end].sort()[0];
      chunks.push({ start, end });
      start = addDays(end, 1);
    }
    return chunks;
  }

  function isoDateInMinsk(timestamp) {
    const parts = minskDateParts(new Date(Number(timestamp)));
    return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  }

  function buildQuarterSelect() {
    const year = getSchoolYear(minskDateParts());
    ui.quarter.replaceChildren();
    QUARTER_NAMES.forEach((name, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = `${name} · ${year}/${String(year + 1).slice(-2)}`;
      ui.quarter.append(option);
    });
    ui.quarter.value = String(quarterIndex);
  }

  async function request(path, token = null, options = {}) {
    const headers = new Headers();
    headers.set('Accept', 'application/json');
    if (token) headers.set('Authorization', token);
    if (options.body) headers.set('Content-Type', 'application/json');

    let response;
    try {
      response = await fetch(`${location.origin}${API}${path}`, {
        method: options.method || 'GET',
        headers,
        body: options.body || undefined,
        credentials: 'include',
        cache: 'no-store'
      });
    } catch {
      const error = new Error('Не удалось подключиться к API дневника. Проверьте соединение и доступность сайта.');
      error.status = 0;
      throw error;
    }

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {}

    if (!response.ok) {
      const message = data && (data.detail || data.message || data.error);
      const error = new Error(typeof message === 'string' ? message : `Ошибка API (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function readDiaryAuth() {
    try {
      const data = JSON.parse(localStorage.getItem('e-school-auth-diary') || 'null');
      return data && typeof data === 'object' ? data : null;
    } catch {
      return null;
    }
  }

  function inspectAuthStorage() {
    try {
      const raw = localStorage.getItem('e-school-auth-diary');
      if (raw === null) return { state: 'missing', token: null };

      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return { state: 'invalid-record', token: null };

      const token = typeof data.authToken === 'string' && data.authToken.trim()
        ? data.authToken.trim()
        : null;
      return { state: token ? 'token-found' : 'token-missing', token };
    } catch {
      return { state: 'unavailable', token: null };
    }
  }

  function getTokenExpiry(token) {
    try {
      const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const binary = atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='));
      const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
      const data = JSON.parse(new TextDecoder().decode(bytes));
      if (!Number.isFinite(data.exp)) return null;
      return {
        expired: data.exp * 1000 <= Date.now(),
        expiresAt: new Date(data.exp * 1000).toLocaleString('ru-RU', { timeZone: TIME_ZONE })
      };
    } catch {
      return null;
    }
  }

  async function fetchParent() {
    const auth = inspectAuthStorage();
    authToken = auth.token;

    if (authToken) {
      try {
        return await request('/admin/auth/me', authToken);
      } catch (error) {
        if (error.status !== 401) throw error;
        const expiry = getTokenExpiry(authToken);
        console.warn('[Дневник: Аналитика] API отклонил токен', {
          storage: auth.state,
          meStatus: error.status,
          tokenExpired: expiry ? expiry.expired : 'unknown',
          tokenExpiresAt: expiry ? expiry.expiresAt : 'unknown'
        });
        authToken = null;
        try {
          return await request('/admin/auth/me');
        } catch (cookieError) {
          if (cookieError.status !== 401) throw cookieError;
          const reason = expiry && expiry.expired
            ? `JWT истёк ${expiry.expiresAt}.`
            : 'API отклонил сохранённый JWT (HTTP 401).';
          throw new Error(`${reason} Обновите страницу дневника и войдите снова.`);
        }
      }
    }

    try {
      return await request('/admin/auth/me');
    } catch (error) {
      if (error.status !== 401) throw error;
      console.warn('[Дневник: Аналитика] Не удалось получить сессию', {
        storage: auth.state,
        tokenFound: false,
        meStatus: error.status
      });
      const reason = auth.state === 'missing'
        ? 'Запись e-school-auth-diary не найдена.'
        : auth.state === 'token-missing'
          ? 'В e-school-auth-diary отсутствует authToken.'
          : auth.state === 'invalid-record'
            ? 'Запись e-school-auth-diary имеет неожиданный формат.'
            : auth.state === 'unavailable'
              ? 'Не удалось прочитать e-school-auth-diary.'
              : 'API дневника вернул HTTP 401 без токена.';
      throw new Error(`${reason} Войдите в дневник, обновите страницу и повторите попытку.`);
    }
  }

  async function apiRequest(path, options = {}) {
    try {
      return await request(path, authToken, options);
    } catch (error) {
      if (error.status === 401) {
        authToken = null;
        throw new Error('Сессия дневника завершилась. Обновите страницу сайта и войдите снова.');
      }
      throw error;
    }
  }

  function asArray(value, ...keys) {
    if (Array.isArray(value)) return value;
    for (const key of keys) {
      if (value && Array.isArray(value[key])) return value[key];
    }
    return [];
  }

  function showStatus(title, message, loading = false) {
    ui.tableWrap.hidden = true;
    ui.state.hidden = false;
    ui.state.replaceChildren();
    const content = document.createElement('p');
    if (loading) {
      const spinner = document.createElement('span');
      spinner.className = 'spinner';
      spinner.setAttribute('aria-hidden', 'true');
      ui.state.append(spinner);
    }
    const heading = document.createElement('strong');
    heading.textContent = title;
    const description = document.createElement('span');
    description.textContent = message;
    content.append(heading, description);
    ui.state.append(content);
  }

  function numericMark(mark) {
    if (mark === null || mark === undefined) return null;
    const value = String(mark).trim();
    if (!value) return null;
    const normalized = value.replace(',', '.');
    const numeric = /^\d+(?:\.\d+)?$/.test(normalized) ? Number(normalized) : null;
    return { mark: value, numeric, comment: '' };
  }

  function collectSubjects(days) {
    const grouped = new Map();
    for (const day of days) {
      for (const slot of asArray(day, 'slots')) {
        const mark = slot && slot.lesson_mark;
        if (!mark || typeof mark !== 'object') continue;
        const grade = numericMark(mark.mark);
        if (!grade) continue;
        grade.comment = typeof mark.comment === 'string' ? mark.comment.trim() : '';
        const subject = typeof slot.subject_title === 'string' && slot.subject_title.trim()
          ? slot.subject_title.trim()
          : 'Без названия';
        if (!grouped.has(subject)) grouped.set(subject, []);
        grouped.get(subject).push(grade);
      }
    }
    return [...grouped.entries()]
      .map(([name, grades]) => {
        const numeric = grades.filter(grade => Number.isFinite(grade.numeric));
        const average = numeric.length
          ? numeric.reduce((sum, grade) => sum + grade.numeric, 0) / numeric.length
          : null;
        return { name, grades, average };
      })
      .sort((left, right) => left.name.localeCompare(right.name, 'ru'));
  }

  function averageClass(value) {
    if (value === null) return 'average-empty';
    if (value >= 4.5) return 'average-green';
    if (value >= 3.5) return 'average-yellow';
    return 'average-red';
  }

  function renderResults(subjects, dates) {
    ui.tbody.replaceChildren();
    const numericGrades = subjects.flatMap(subject => subject.grades.filter(grade => Number.isFinite(grade.numeric)));
    const overall = numericGrades.length
      ? numericGrades.reduce((sum, grade) => sum + grade.numeric, 0) / numericGrades.length
      : null;
    ui.overall.textContent = overall === null ? '—' : overall.toFixed(2);
    ui.overall.style.color = overall === null ? '#172033' : overall >= 4.5 ? '#138044' : overall >= 3.5 ? '#946900' : '#bd4031';
    const countWord = numericGrades.length === 1 ? 'оценка' : numericGrades.length >= 2 && numericGrades.length <= 4 ? 'оценки' : 'оценок';
    ui.overallNote.textContent = `${numericGrades.length} числовых ${countWord}`;
    ui.subjectCount.textContent = String(subjects.length);
    const allGradeCount = subjects.reduce((sum, subject) => sum + subject.grades.length, 0);
    ui.gradeCount.textContent = `оценок: ${allGradeCount}`;

    for (const subject of subjects) {
      const row = document.createElement('tr');
      const subjectCell = document.createElement('td');
      subjectCell.className = 'subject';
      subjectCell.textContent = subject.name;

      const gradesCell = document.createElement('td');
      const grades = document.createElement('div');
      grades.className = 'grades';
      for (const grade of subject.grades) {
        const pill = document.createElement('span');
        pill.className = 'grade';
        pill.textContent = grade.comment ? `${grade.mark} (${grade.comment})` : grade.mark;
        grades.append(pill);
      }
      gradesCell.append(grades);

      const averageCell = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = `average ${averageClass(subject.average)}`;
      badge.textContent = subject.average === null ? '—' : subject.average.toFixed(2);
      averageCell.append(badge);
      row.append(subjectCell, gradesCell, averageCell);
      ui.tbody.append(row);
    }

    if (!subjects.length) {
      showStatus('Оценок пока нет', 'За выбранный период дневник не вернул оценок.');
      return;
    }
    ui.state.hidden = true;
    ui.tableWrap.hidden = false;
  }

  async function fetchClassAssignments(student, dates, sequence) {
    const chunks = makeDateChunks(dates);
    const classByDate = Object.create(null);
    let nextIndex = 0;
    let loaded = 0;
    const workers = Math.min(3, chunks.length);

    async function worker() {
      while (nextIndex < chunks.length) {
        const index = nextIndex++;
        const chunk = chunks[index];
        const response = await apiRequest(
          `/education/diary/schools/${encodeURIComponent(student.school_id)}/students/${encodeURIComponent(student.profile_id)}/classes`,
          {
            method: 'POST',
            body: JSON.stringify({ from: formatApiDate(chunk.start), to: formatApiDate(chunk.end) })
          }
        );
        const dateMap = response && response.classes_by_date && typeof response.classes_by_date === 'object'
          ? response.classes_by_date
          : {};

        for (let date = chunk.start; date <= chunk.end; date = addDays(date, 1)) {
          const assigned = dateMap[date];
          const classIds = Array.isArray(assigned) ? assigned : typeof assigned === 'string' ? [assigned] : [];
          if (classIds.length && classIds[0]) classByDate[date] = classIds[0];
        }

        const classes = asArray(response, 'classes').filter(item => item && item.uuid);
        if (classes.length === 1) {
          for (let date = chunk.start; date <= chunk.end; date = addDays(date, 1)) {
            if (!classByDate[date]) classByDate[date] = classes[0].uuid;
          }
        }

        loaded++;
        if (sequence === loadSequence) {
          showStatus('Определяем класс', `Обработано отрезков: ${loaded} из ${chunks.length}.`, true);
        }
      }
    }

    await Promise.all(Array.from({ length: workers }, worker));
    return classByDate;
  }

  function classForWeek(week, classByDate, dates) {
    const firstDate = [isoDateInMinsk(week.start_ts), dates.start].sort().at(-1);
    const lastDate = [isoDateInMinsk(week.end_ts), dates.end].sort()[0];
    for (let date = firstDate; date <= lastDate; date = addDays(date, 1)) {
      if (classByDate[date]) return classByDate[date];
    }
    return null;
  }

  async function fetchLessons(student, weeks, classByDate, dates, sequence) {
    const daysByWeek = new Array(weeks.length);
    let nextIndex = 0;
    let loaded = 0;
    const workers = Math.min(4, weeks.length);

    async function worker() {
      while (nextIndex < weeks.length) {
        const index = nextIndex++;
        const week = weeks[index];
        const classId = classForWeek(week, classByDate, dates);
        if (!classId) throw new Error(`Не удалось определить класс для недели «${week.summary || week.uuid}».`);
        const weekId = encodeURIComponent(week.uuid);
        const path = `/education/diary/schools/${encodeURIComponent(student.school_id)}/classes/${encodeURIComponent(classId)}/students/${encodeURIComponent(student.profile_id)}/lessons?week_activity_uuid=${weekId}`;
        daysByWeek[index] = asArray(await apiRequest(path), 'days', 'lessons');
        loaded++;
        if (sequence === loadSequence) showStatus('Загружаем оценки', `Получено недель: ${loaded} из ${weeks.length}.`, true);
      }
    }

    await Promise.all(Array.from({ length: workers }, worker));
    return daysByWeek.flat();
  }

  async function loadAnalytics() {
    const sequence = ++loadSequence;
    const dates = getQuarterDates(quarterIndex, getSchoolYear(minskDateParts()));
    ui.overall.textContent = '—';
    ui.overall.style.color = '#172033';
    ui.overallNote.textContent = 'по числовым оценкам';
    ui.subjectCount.textContent = '—';
    ui.gradeCount.textContent = 'оценок: —';
    showStatus('Подключаемся к дневнику', 'Получаем список учеников и оценки за четверть.', true);

    try {
      const parent = await fetchParent();
      if (sequence !== loadSequence) return;
      const students = asArray(parent, 'students_for_parent')
        .filter(student => student && student.profile_id && student.school_id);
      if (!students.length) throw new Error('В аккаунте не найдено ни одного ученика.');

      const siteActiveChild = readDiaryAuth()?.person?.activeChild;
      const savedStudentId = localStorage.getItem(STUDENT_KEY) || siteActiveChild;
      const selected = students.find(student => student.profile_id === savedStudentId) || students[0];
      ui.student.replaceChildren();
      for (const student of students) {
        const option = document.createElement('option');
        option.value = student.profile_id;
        option.textContent = student.full_name || 'Ученик';
        ui.student.append(option);
      }
      ui.student.value = selected.profile_id;
      ui.studentField.hidden = students.length < 2;
      localStorage.setItem(STUDENT_KEY, selected.profile_id);

      const [weeksResponse, classByDate] = await Promise.all([
        apiRequest('/education/diary/time_activities/week_activities'),
        fetchClassAssignments(selected, dates, sequence)
      ]);
      if (sequence !== loadSequence) return;

      const weeks = asArray(weeksResponse, 'week_activities')
        .filter(week => week && week.uuid && Number.isFinite(Number(week.start_ts)) && Number.isFinite(Number(week.end_ts)))
        .filter(week => isoDateInMinsk(week.start_ts) <= dates.end && isoDateInMinsk(week.end_ts) >= dates.start)
        .sort((left, right) => Number(left.start_ts) - Number(right.start_ts));

      if (!weeks.length) {
        renderResults([], dates);
        return;
      }

      const days = await fetchLessons(selected, weeks, classByDate, dates, sequence);
      if (sequence !== loadSequence) return;
      renderResults(collectSubjects(days), dates);
    } catch (error) {
      if (sequence !== loadSequence) return;
      console.error('[Дневник: Аналитика]', {
        message: error.message || 'Неизвестная ошибка',
        status: Number.isInteger(error.status) ? error.status : null
      });
      const status = Number.isInteger(error.status) && error.status > 0
        ? ` (HTTP ${error.status})`
        : '';
      showStatus('Не удалось загрузить данные', `${error.message || 'Повторите попытку позже.'}${status}`);
    }
  }

  function openPanel() {
    ui.panel.hidden = false;
    ui.launcher.hidden = true;
    loadAnalytics();
  }

  function closePanel() {
    ui.panel.hidden = true;
    ui.launcher.hidden = false;
  }

  buildQuarterSelect();
  ui.launcher.addEventListener('click', openPanel);
  ui.close.addEventListener('click', closePanel);
  ui.refresh.addEventListener('click', loadAnalytics);
  ui.quarter.addEventListener('change', () => {
    quarterIndex = Number(ui.quarter.value);
    localStorage.setItem(QUARTER_KEY, String(quarterIndex));
    loadAnalytics();
  });
  ui.student.addEventListener('change', () => {
    localStorage.setItem(STUDENT_KEY, ui.student.value);
    loadAnalytics();
  });
  shadow.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !ui.panel.hidden) closePanel();
  });
})();
