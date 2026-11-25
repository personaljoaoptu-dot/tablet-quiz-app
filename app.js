/**
 * Avaliação Garden Gold - Mecânica da Aplicação Web para Tablet Android
 * Com suporte a Banco de Dados na Nuvem (Supabase) + Painel de Relatórios
 */

(function () {
  'use strict';

  // --- Estado da Aplicação ---
  let questions = [];
  let currentIndex = 0;
  let userAnswers = {}; // { [qIndex]: { selectedIndex: number, isCorrect: boolean } }
  let mode = localStorage.getItem('garden_gold_mode') || 'exam'; // 'exam' (modo avaliação) ou 'study' (treino com feedback na hora)
  let soundEnabled = true;
  let candidateName = '';
  let examStartTime = null;

  // Cliente do Banco em Nuvem (Supabase)
  let supabase = null;
  let allEvaluationsCache = [];

  // Tela de Bloqueio do App (Admin Pin Inicial)
  const appLockScreen = document.getElementById('app-lock-screen');
  const formUnlockApp = document.getElementById('form-unlock-app');
  const appUnlockPin = document.getElementById('app-unlock-pin');
  const unlockError = document.getElementById('unlock-error');
  const btnLockApp = document.getElementById('btn-lock-app');

  // --- Elementos do DOM ---
  const welcomeScreen = document.getElementById('welcome-screen');
  const studentNameInput = document.getElementById('student-name');
  const formStartQuiz = document.getElementById('form-start-quiz');
  const btnStartQuiz = document.getElementById('btn-start-quiz');
  const quizTotalCount = document.getElementById('quiz-total-count');
  const displayStudentName = document.getElementById('display-student-name');
  const headerModeText = document.getElementById('header-mode-text');
  const resultModeBadge = document.getElementById('result-mode-badge');

  const quizTopBar = document.getElementById('quiz-top-bar');
  const quizArea = document.getElementById('quiz-area');
  const questionBadge = document.getElementById('question-badge');
  const progressFill = document.getElementById('progress-fill');
  const scoreCounter = document.getElementById('score-counter');
  const currentModeLabel = document.getElementById('current-mode-label');
  const questionText = document.getElementById('question-text');
  const imagesContainer = document.getElementById('images-container');
  const optionsList = document.getElementById('options-list');
  const feedbackBox = document.getElementById('feedback-box');
  const feedbackTitle = document.getElementById('feedback-title');
  const feedbackText = document.getElementById('feedback-text');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');

  // Tela de Resultados
  const resultScreen = document.getElementById('result-screen');
  const resultStudentName = document.getElementById('result-student-name');
  const resultDate = document.getElementById('result-date');
  const cloudSyncStatus = document.getElementById('cloud-sync-status');
  const btnNewParticipant = document.getElementById('btn-new-participant');
  const btnRestart = document.getElementById('btn-restart');

  // Painel de Relatórios / Admin
  const btnAdmin = document.getElementById('btn-admin');
  const adminModal = document.getElementById('admin-modal');
  const adminModalClose = document.getElementById('admin-modal-close');
  const adminTableBody = document.getElementById('admin-table-body');
  const adminSearch = document.getElementById('admin-search');
  const btnRefreshReports = document.getElementById('btn-refresh-reports');
  const btnExportCsv = document.getElementById('btn-export-csv');
  const btnExportPdf = document.getElementById('btn-export-pdf');
  const adminTotalParticipants = document.getElementById('admin-total-participants');
  const adminAverageScore = document.getElementById('admin-average-score');

  // Modal Detalhes do Aluno
  const detailModal = document.getElementById('detail-modal');
  const detailCandidateTitle = document.getElementById('detail-candidate-title');
  const detailBody = document.getElementById('detail-body');
  const detailModalClose = document.getElementById('detail-modal-close');
  const btnExportCandidatePdf = document.getElementById('btn-export-candidate-pdf');
  const btnExportResultPdf = document.getElementById('btn-export-result-pdf');
  let currentSelectedCandidate = null;

  // Modais e Controles Globais
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCaption = document.getElementById('lightbox-caption');
  const lightboxClose = document.getElementById('lightbox-close');
  const btnToggleMode = document.getElementById('btn-toggle-mode');
  const btnSound = document.getElementById('btn-sound');
  const btnTheme = document.getElementById('btn-theme');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const fileLoader = document.getElementById('file-loader');

  // Letras das alternativas
  const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

  // --- Efeitos Sonoros com Web Audio API ---
  const audioCtx = (window.AudioContext || window.webkitAudioContext) ? new (window.AudioContext || window.webkitAudioContext)() : null;

  function playTone(freq, duration, type = 'sine') {
    if (!soundEnabled || !audioCtx) return;
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.warn('Erro ao reproduzir áudio:', e);
    }
  }

  function playSuccessSound() {
    playTone(523.25, 0.12);
    setTimeout(() => playTone(659.25, 0.15), 100);
    setTimeout(() => playTone(783.99, 0.25), 200);
  }

  function playErrorSound() {
    playTone(220, 0.15, 'sawtooth');
    setTimeout(() => playTone(180, 0.25, 'sawtooth'), 120);
  }

  function playClickSound() {
    playTone(400, 0.04);
  }

  // --- Indicador Centralizado de Modo (Avaliação vs Estudo) ---
  function updateModeDisplay() {
    const isExam = (mode === 'exam');

    // Botão / Pílula do Cabeçalho
    if (headerModeText) {
      headerModeText.textContent = isExam ? 'Modo: Avaliação' : 'Modo: Estudo';
    }
    if (btnToggleMode) {
      btnToggleMode.className = `mode-pill-btn ${isExam ? 'mode-exam' : 'mode-study'}`;
      btnToggleMode.title = `Modo atual: ${isExam ? 'Avaliação (Gabarito no final)' : 'Estudo (Feedback imediato)'}. Toque para alternar (Exige Senha)`;
    }

    if (btnStartQuiz) {
      btnStartQuiz.textContent = isExam ? 'Iniciar Avaliação →' : 'Iniciar Treino de Estudo →';
    }

    // Barra Superior do Quiz (Durante o Teste)
    if (currentModeLabel) {
      currentModeLabel.textContent = isExam ? 'Avaliação' : 'Estudo';
      currentModeLabel.className = `stat-val badge-mode ${isExam ? 'badge-exam' : 'badge-study'}`;
    }

    // Tela de Resultados Finais
    if (resultModeBadge) {
      resultModeBadge.textContent = isExam ? 'Modo Avaliação' : 'Modo Estudo';
      resultModeBadge.className = `badge-mode ${isExam ? 'badge-exam' : 'badge-study'}`;
    }

    localStorage.setItem('garden_gold_mode', mode);
  }

  // --- Inicialização ---
  async function initApp() {
    initSupabase();
    setupEventListeners();
    checkLockStatus();
    updateModeDisplay();
    await loadQuestions();
  }

  function checkLockStatus() {
    const isUnlocked = sessionStorage.getItem('garden_gold_unlocked') === 'true';
    if (isUnlocked) {
      appLockScreen.classList.add('unlocked');
    } else {
      appLockScreen.classList.remove('unlocked');
      setTimeout(() => appUnlockPin.focus(), 250);
    }
  }

  function initSupabase() {
    if (window.supabase && window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url) {
      if (!window.SUPABASE_CONFIG.url.includes('SEU-PROJETO')) {
        try {
          const cleanUrl = window.SUPABASE_CONFIG.url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
          supabase = window.supabase.createClient(cleanUrl, window.SUPABASE_CONFIG.anonKey);
          console.log('✓ Supabase conectado com sucesso em:', cleanUrl);
        } catch (e) {
          console.warn('Não foi possível conectar ao Supabase:', e);
        }
      }
    }
  }

  async function loadQuestions() {
    try {
      const response = await fetch('questions.json?t=' + Date.now());
      if (!response.ok) throw new Error('Falha ao carregar JSON');
      const data = await response.json();
      if (Array.isArray(data)) {
        questions = data;
      }
    } catch (err) {
      console.warn('Usando fallback window.QUIZ_QUESTIONS:', err);
      if (window.QUIZ_QUESTIONS && Array.isArray(window.QUIZ_QUESTIONS)) {
        questions = window.QUIZ_QUESTIONS;
      }
    }

    if (questions.length === 0) {
      quizTotalCount.textContent = 'Nenhuma questão cadastrada ainda no arquivo questions.json.';
      quizTotalCount.style.color = 'var(--warning)';
    } else {
      quizTotalCount.textContent = `Total de questões disponíveis: ${questions.length}`;
      quizTotalCount.style.color = 'var(--text-muted)';
    }
  }

  function tryEnableFullscreen() {
    try {
      if (!document.fullscreenElement) {
        const el = document.documentElement;
        if (el.requestFullscreen) {
          el.requestFullscreen().catch(() => {});
        } else if (el.webkitRequestFullscreen) {
          el.webkitRequestFullscreen();
        }
      }
    } catch (e) {
      // Ignora restrições do navegador se houver
    }
  }

  // --- Iniciar Avaliação com o Nome Completo ---
  function handleStartQuiz() {
    const name = studentNameInput.value.trim();
    if (!name) {
      alert('Por favor, informe seu nome completo antes de iniciar.');
      studentNameInput.focus();
      return;
    }

    if (questions.length === 0) {
      alert('Ainda não há questões cadastradas em questions.json. Adicione as questões para iniciar!');
      return;
    }

    tryEnableFullscreen();

    candidateName = name;
    displayStudentName.textContent = candidateName;
    examStartTime = new Date();
    currentIndex = 0;
    userAnswers = {};

    welcomeScreen.style.display = 'none';
    resultScreen.classList.remove('active');
    quizTopBar.style.display = 'flex';
    quizArea.style.display = 'grid';

    playClickSound();
    renderQuestion(currentIndex);
    updateScoreDisplay();
  }

  // --- Renderização da Questão ---
  function renderQuestion(index) {
    if (!questions || questions.length === 0) return;
    const q = questions[index];

    questionBadge.textContent = `Questão ${index + 1} de ${questions.length}`;
    const progressPercent = ((index + 1) / questions.length) * 100;
    progressFill.style.width = `${progressPercent}%`;

    questionText.textContent = q.question;

    renderImages(q.images);
    renderOptions(q, index);
    updateFeedbackBox(index);

    btnPrev.disabled = index === 0;
    btnNext.disabled = userAnswers[index] === undefined;
    btnNext.textContent = (index === questions.length - 1) ? 'Finalizar e Entregar ✓' : 'Próxima Questão →';
  }

  // --- Renderizador de Imagens Múltiplas ---
  function renderImages(images) {
    imagesContainer.innerHTML = '';

    if (!images || images.length === 0) {
      imagesContainer.style.display = 'none';
      return;
    }

    imagesContainer.style.display = 'grid';
    const count = images.length;
    imagesContainer.className = `images-container count-${Math.min(count, 4)}`;

    images.forEach((imgItem, idx) => {
      const src = typeof imgItem === 'string' ? imgItem : imgItem.src;
      const caption = typeof imgItem === 'object' && imgItem.caption ? imgItem.caption : `Imagem ${idx + 1}`;

      const card = document.createElement('div');
      card.className = 'image-card';
      card.title = 'Toque para ver em tela cheia';

      card.innerHTML = `
        <div class="image-wrapper">
          <img src="${src}" alt="${caption}" loading="lazy">
          <div class="zoom-hint">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
            Ampliar
          </div>
        </div>
        ${caption ? `<div class="image-caption">${caption}</div>` : ''}
      `;

      card.addEventListener('click', () => openLightbox(src, caption));
      imagesContainer.appendChild(card);
    });
  }

  // --- Renderizador de Alternativas ---
  function renderOptions(q, qIndex) {
    optionsList.innerHTML = '';
    const answerInfo = userAnswers[qIndex];
    const isAnswered = answerInfo !== undefined;

    q.options.forEach((optText, optIdx) => {
      const btn = document.createElement('button');
      btn.className = 'option-button';
      const letter = OPTION_LETTERS[optIdx] || String.fromCharCode(65 + optIdx);

      btn.innerHTML = `
        <div class="option-letter">${letter}</div>
        <div class="option-text">${optText}</div>
      `;

      if (isAnswered) {
        if (optIdx === answerInfo.selectedIndex) {
          btn.classList.add('selected');
        }

        if (mode === 'study') {
          btn.disabled = true;
          if (optIdx === q.correctIndex) {
            btn.classList.add('correct');
          } else if (optIdx === answerInfo.selectedIndex && !answerInfo.isCorrect) {
            btn.classList.add('wrong');
          }
        }
      }

      btn.addEventListener('click', () => handleSelectOption(qIndex, optIdx));
      optionsList.appendChild(btn);
    });
  }

  // --- Manipulação da Resposta ---
  function handleSelectOption(qIndex, selectedIndex) {
    const q = questions[qIndex];
    const isCorrect = selectedIndex === q.correctIndex;

    userAnswers[qIndex] = {
      selectedIndex,
      isCorrect
    };

    if (mode === 'study') {
      if (isCorrect) playSuccessSound();
      else playErrorSound();
      renderQuestion(qIndex);
      updateScoreDisplay();
    } else {
      playClickSound();
      renderQuestion(qIndex);
    }
  }

  // --- Feedback Box (Modo Estudo) ---
  function updateFeedbackBox(qIndex) {
    const answerInfo = userAnswers[qIndex];
    const q = questions[qIndex];

    if (mode !== 'study' || !answerInfo) {
      feedbackBox.className = 'feedback-box';
      feedbackBox.style.display = 'none';
      return;
    }

    feedbackBox.style.display = 'block';
    if (answerInfo.isCorrect) {
      feedbackBox.className = 'feedback-box active correct';
      feedbackTitle.innerHTML = '✓ Resposta Correta!';
    } else {
      feedbackBox.className = 'feedback-box active wrong';
      const correctLetter = OPTION_LETTERS[q.correctIndex] || (q.correctIndex + 1);
      feedbackTitle.innerHTML = `✕ Alternativa correta: (${correctLetter})`;
    }

    feedbackText.textContent = q.explanation || 'Sem explicação adicional.';
  }

  function updateScoreDisplay() {
    let score = 0;
    Object.values(userAnswers).forEach(ans => {
      if (ans.isCorrect) score++;
    });
    scoreCounter.textContent = score;
  }

  // --- Finalização e Envio para Banco de Dados ---
  async function showResults() {
    quizArea.style.display = 'none';
    quizTopBar.style.display = 'none';
    resultScreen.classList.add('active');

    resultStudentName.textContent = candidateName || 'Não identificado';
    const now = new Date();
    resultDate.textContent = `Realizado em: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}`;
    if (resultModeBadge) {
      resultModeBadge.textContent = (mode === 'exam') ? 'Modo Avaliação' : 'Modo Estudo';
      resultModeBadge.className = `badge-mode ${mode === 'exam' ? 'badge-exam' : 'badge-study'}`;
    }

    let correctCount = 0;
    questions.forEach((q, idx) => {
      if (userAnswers[idx] && userAnswers[idx].isCorrect) {
        correctCount++;
      }
    });

    const total = questions.length;
    const wrongCount = total - correctCount;
    const percentage = Math.round((correctCount / total) * 100);

    document.getElementById('result-score').textContent = `${correctCount} / ${total}`;
    document.getElementById('result-percentage').textContent = `${percentage}% de Aproveitamento`;
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-correct').textContent = correctCount;
    document.getElementById('stat-wrong').textContent = wrongCount;

    const emojiEl = document.getElementById('result-emoji');
    if (percentage >= 80) emojiEl.textContent = '🏆';
    else if (percentage >= 60) emojiEl.textContent = '👍';
    else emojiEl.textContent = '📝';

    // Salva o relatório no banco de dados
    await saveEvaluationToDatabase({
      candidate_name: candidateName,
      score: correctCount,
      total: total,
      percentage: percentage,
      created_at: now.toISOString(),
      answers: questions.map((q, idx) => ({
        q_num: idx + 1,
        question: q.question,
        selected: userAnswers[idx] ? q.options[userAnswers[idx].selectedIndex] : 'Não respondida',
        correct: q.options[q.correctIndex],
        is_correct: userAnswers[idx] ? userAnswers[idx].isCorrect : false
      }))
    });

    // Revisão das Questões na Tela
    const reviewList = document.getElementById('result-review-list');
    reviewList.innerHTML = '<h3 style="font-size:16px; margin-bottom:12px; font-weight:700;">Revisão das Questões:</h3>';

    questions.forEach((q, idx) => {
      const userAns = userAnswers[idx];
      const isRight = userAns && userAns.isCorrect;
      const userChoiceText = userAns ? q.options[userAns.selectedIndex] : 'Não respondida';
      const correctChoiceText = q.options[q.correctIndex];

      const item = document.createElement('div');
      item.className = `review-item ${isRight ? 'correct' : 'wrong'}`;
      item.innerHTML = `
        <div class="review-q">#${idx + 1}: ${q.question}</div>
        <div class="review-ans">Resposta informada: <strong>${userChoiceText}</strong> ${isRight ? '✓' : '✕'}</div>
        ${!isRight ? `<div class="review-ans" style="color:var(--success);">Gabarito: <strong>${correctChoiceText}</strong></div>` : ''}
        ${q.explanation ? `<div class="review-ans" style="margin-top:4px; font-style:italic;">Explicação: ${q.explanation}</div>` : ''}
      `;
      reviewList.appendChild(item);
    });

    if (percentage >= 60) playSuccessSound();
  }

  // --- Função de Salvamento no Banco (Supabase + LocalStorage de Backup) ---
  async function saveEvaluationToDatabase(record) {
    // 1. Sempre salva no LocalStorage do Tablet como garantia offline
    try {
      const localData = JSON.parse(localStorage.getItem('garden_gold_evaluations') || '[]');
      localData.unshift(record);
      localStorage.setItem('garden_gold_evaluations', JSON.stringify(localData));
    } catch (e) {
      console.warn('Erro ao salvar localmente:', e);
    }

    // 2. Se o Supabase estiver conectado, envia para a Nuvem
    if (supabase) {
      cloudSyncStatus.textContent = 'Enviando avaliação para o banco de dados em nuvem...';
      try {
        const { error } = await supabase.from('avaliacoes').insert([{
          candidate_name: record.candidate_name,
          score: record.score,
          total: record.total,
          percentage: record.percentage,
          answers: record.answers,
          created_at: record.created_at
        }]);

        if (error) throw error;
        cloudSyncStatus.textContent = '✓ Avaliação gravada no Banco de Dados em Nuvem (Supabase)!';
        cloudSyncStatus.style.color = 'var(--success)';
      } catch (err) {
        console.error('Erro ao enviar para Supabase:', err);
        cloudSyncStatus.textContent = '⚠️ Gravado no tablet (offline). Não foi possível conectar ao banco em nuvem.';
        cloudSyncStatus.style.color = 'var(--warning)';
      }
    } else {
      cloudSyncStatus.textContent = 'ℹ️ Gravado no tablet. (Para sincronizar com a nuvem, configure o Supabase em config.js).';
      cloudSyncStatus.style.color = 'var(--text-dim)';
    }
  }

  // --- Painel de Relatórios do Administrador ---
  async function openAdminPanel() {
    const pin = prompt('Digite a senha de Administrador para acessar os relatórios:');
    const expectedPin = (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.adminPin) ? window.SUPABASE_CONFIG.adminPin : '951233';

    if (pin !== expectedPin) {
      if (pin !== null) alert('Senha incorreta.');
      return;
    }

    adminModal.classList.add('active');
    await loadReportsData();
  }

  async function loadReportsData() {
    adminTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 24px;">Carregando registros...</td></tr>';
    let data = [];

    // Tenta buscar da nuvem primeiro
    if (supabase) {
      try {
        const { data: cloudData, error } = await supabase
          .from('avaliacoes')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && cloudData) {
          data = cloudData;
        }
      } catch (e) {
        console.warn('Falha ao carregar do Supabase:', e);
      }
    }

    // Se a nuvem falhou ou não está configurada, usa o histórico local do tablet
    if (!data || data.length === 0) {
      data = JSON.parse(localStorage.getItem('garden_gold_evaluations') || '[]');
    }

    allEvaluationsCache = data;
    renderAdminTable(allEvaluationsCache);
  }

  function renderAdminTable(list) {
    adminTableBody.innerHTML = '';

    if (!list || list.length === 0) {
      adminTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 24px; color: var(--text-dim);">Nenhuma avaliação registrada até o momento.</td></tr>';
      adminTotalParticipants.textContent = '0';
      adminAverageScore.textContent = '0%';
      return;
    }

    adminTotalParticipants.textContent = list.length;
    const avg = Math.round(list.reduce((acc, curr) => acc + (curr.percentage || 0), 0) / list.length);
    adminAverageScore.textContent = `${avg}%`;

    list.forEach((item, index) => {
      const tr = document.createElement('tr');
      const dateStr = item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : '-';

      tr.innerHTML = `
        <td style="color: var(--text-muted); font-size: 13px;">${dateStr}</td>
        <td><strong>${item.candidate_name || 'Anônimo'}</strong></td>
        <td><span style="color: var(--primary); font-weight:700;">${item.score} / ${item.total}</span></td>
        <td>
          <span style="color: ${item.percentage >= 60 ? 'var(--success)' : 'var(--danger)'}; font-weight:700;">
            ${item.percentage}%
          </span>
        </td>
        <td>
          <button class="btn btn-secondary btn-sm" data-idx="${index}">
            🔍 Ver Questões
          </button>
        </td>
      `;

      tr.querySelector('button').addEventListener('click', () => openCandidateDetail(item));
      adminTableBody.appendChild(tr);
    });
  }

  // --- Visualizar Detalhes das Respostas do Candidato ---
  function openCandidateDetail(candidate) {
    currentSelectedCandidate = candidate;
    detailCandidateTitle.textContent = `Avaliação de: ${candidate.candidate_name}`;
    detailBody.innerHTML = `
      <div style="margin-bottom: 16px; padding: 12px; background: var(--bg-card-alt); border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
        <div><strong>Acertos:</strong> ${candidate.score} de ${candidate.total} (${candidate.percentage}%)</div>
        <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Data: ${new Date(candidate.created_at).toLocaleString('pt-BR')}</div>
      </div>
      <h4 style="font-size: 14px; margin-bottom: 12px; font-weight:700;">Detalhamento Questão por Questão:</h4>
    `;

    if (candidate.answers && Array.isArray(candidate.answers)) {
      candidate.answers.forEach(ans => {
        const item = document.createElement('div');
        item.className = `review-item ${ans.is_correct ? 'correct' : 'wrong'}`;
        item.innerHTML = `
          <div class="review-q">Questão #${ans.q_num}: ${ans.question}</div>
          <div class="review-ans">Resposta marcada: <strong>${ans.selected}</strong> ${ans.is_correct ? '✓' : '✕'}</div>
          ${!ans.is_correct ? `<div class="review-ans" style="color:var(--success);">Gabarito correto: <strong>${ans.correct}</strong></div>` : ''}
        `;
        detailBody.appendChild(item);
      });
    } else {
      detailBody.innerHTML += '<div style="color: var(--text-dim);">Respostas detalhadas não disponíveis para este registro.</div>';
    }

    detailModal.classList.add('active');
  }

  // --- Exportar Relatório Geral Consolidado para PDF ---
  function exportGeneralReportsPdf() {
    if (!allEvaluationsCache || allEvaluationsCache.length === 0) {
      alert('Não há avaliações registradas para exportar.');
      return;
    }

    if (!window.jspdf || !window.jspdf.jsPDF) {
      window.print();
      return;
    }

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const now = new Date();
      const dateStr = now.toLocaleDateString('pt-BR');
      const timeStr = now.toLocaleTimeString('pt-BR');

      // Cabeçalho Navy Garden Gold
      doc.setFillColor(15, 23, 42); // #0f172a
      doc.rect(0, 0, 210, 36, 'F');

      // Título Dourado Oficial
      doc.setTextColor(250, 204, 21); // #facc15
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('AVALIAÇÃO GARDEN GOLD', 14, 16);

      // Subtítulo
      doc.setTextColor(226, 232, 240);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('Relatório Consolidado de Desempenho e Avaliações de Alunos', 14, 24);

      // Metadados
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(8.5);
      doc.text(`Emitido em: ${dateStr} às ${timeStr} | Total: ${allEvaluationsCache.length} participante(s)`, 14, 31);

      // Cards Resumo de Estatísticas
      const total = allEvaluationsCache.length;
      const avg = Math.round(allEvaluationsCache.reduce((acc, curr) => acc + (curr.percentage || 0), 0) / total);
      const approvedCount = allEvaluationsCache.filter(item => (item.percentage || 0) >= 70).length;
      const approvedRate = Math.round((approvedCount / total) * 100);

      // Card 1: Total
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(14, 42, 58, 18, 2, 2, 'F');
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('TOTAL DE AVALIAÇÕES', 18, 48);
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(String(total), 18, 56);

      // Card 2: Média
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(76, 42, 58, 18, 2, 2, 'F');
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('MÉDIA GERAL', 80, 48);
      doc.setTextColor(202, 138, 4);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`${avg}%`, 80, 56);

      // Card 3: Taxa de Aprovação (>= 70%)
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(138, 42, 58, 18, 2, 2, 'F');
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('APROVAÇÃO (>= 70%)', 142, 48);
      doc.setTextColor(16, 185, 129);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`${approvedCount} (${approvedRate}%)`, 142, 56);

      // Tabela de Dados
      const tableData = allEvaluationsCache.map((item, idx) => {
        const itemDate = item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : '-';
        const pct = item.percentage !== undefined ? item.percentage : Math.round(((item.score || 0) / (item.total || 1)) * 100);
        const status = pct >= 70 ? 'APROVADO' : 'EM ANÁLISE';
        const modeLabel = item.mode === 'study' ? 'Estudo' : 'Avaliação';
        return [
          String(idx + 1),
          itemDate,
          item.candidate_name || 'Anônimo',
          modeLabel,
          `${item.score} / ${item.total}`,
          `${pct}%`,
          status
        ];
      });

      doc.autoTable({
        startY: 66,
        head: [['#', 'Data / Hora', 'Nome do Candidato', 'Modo', 'Acertos', 'Aprov.', 'Situação']],
        body: tableData,
        theme: 'striped',
        styles: {
          font: 'helvetica',
          fontSize: 8.5,
          cellPadding: 3,
          overflow: 'linebreak'
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [250, 204, 21],
          fontStyle: 'bold',
          halign: 'left'
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 34 },
          2: { cellWidth: 54 },
          3: { cellWidth: 20 },
          4: { cellWidth: 20, halign: 'center' },
          5: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
          6: { cellWidth: 26, halign: 'center', fontStyle: 'bold' }
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        didParseCell: function(data) {
          if (data.section === 'body' && data.column.index === 6) {
            if (data.cell.raw === 'APROVADO') {
              data.cell.styles.textColor = [16, 185, 129];
            } else {
              data.cell.styles.textColor = [239, 68, 68];
            }
          }
        },
        margin: { left: 14, right: 14 }
      });

      // Rodapé
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Garden Gold Academia • Sistema de Gestão de Desempenho • Página ${i} de ${pageCount}`,
          14,
          290
        );
      }

      doc.save(`relatorio_geral_garden_gold_${Date.now()}.pdf`);
      playSuccessSound();
    } catch (err) {
      console.error('Erro ao gerar PDF geral:', err);
      alert('Houve um erro ao gerar o arquivo PDF. Tente novamente.');
    }
  }

  // --- Exportar Relatório Individual do Candidato para PDF ---
  function exportCandidatePdf(candidate) {
    if (!candidate) {
      alert('Nenhum candidato selecionado para exportação.');
      return;
    }

    if (!window.jspdf || !window.jspdf.jsPDF) {
      window.print();
      return;
    }

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const candName = candidate.candidate_name || 'Candidato';
      const dateStr = candidate.created_at ? new Date(candidate.created_at).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
      const pct = candidate.percentage !== undefined ? candidate.percentage : Math.round(((candidate.score || 0) / (candidate.total || 1)) * 100);
      const isApproved = pct >= 70;
      const statusText = isApproved ? 'APROVADO' : 'NÃO ATINGIU A MÉDIA MÍNIMA (70%)';

      // Top Banner
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 36, 'F');

      doc.setTextColor(250, 204, 21);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(17);
      doc.text('AVALIAÇÃO GARDEN GOLD', 14, 15);

      doc.setTextColor(226, 232, 240);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('Boletim Individual de Desempenho do Aluno / Candidato', 14, 23);

      doc.setTextColor(148, 163, 184);
      doc.setFontSize(8.5);
      doc.text(`Registro Oficial de Avaliação • Emitido em: ${new Date().toLocaleString('pt-BR')}`, 14, 30);

      // Box do Candidato
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, 42, 182, 30, 2, 2, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(14, 42, 182, 30, 2, 2, 'S');

      // Nome do Candidato
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(`Candidato: ${candName}`, 20, 52);

      // Detalhes da Prova
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`Data do Teste: ${dateStr}`, 20, 60);
      doc.text(`Modo Realizado: ${candidate.mode === 'study' ? 'Treino (Estudo)' : 'Avaliação Oficial'}`, 20, 66);

      // Pontuação em Destaque no Box
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(isApproved ? 16 : 225, isApproved ? 185 : 29, isApproved ? 129 : 72);
      doc.text(`${candidate.score} / ${candidate.total} (${pct}%)`, 130, 54);

      doc.setFontSize(8.5);
      doc.text(`Situação: ${statusText}`, 130, 63);

      // Tabela Detalhada de Respostas Questão por Questão
      const tableRows = [];
      if (candidate.answers && Array.isArray(candidate.answers) && candidate.answers.length > 0) {
        candidate.answers.forEach(ans => {
          tableRows.push([
            String(ans.q_num),
            ans.question || '',
            ans.selected || '',
            ans.correct || '',
            ans.is_correct ? 'CORRETO' : 'INCORRETO'
          ]);
        });
      }

      if (tableRows.length > 0) {
        doc.autoTable({
          startY: 78,
          head: [['#', 'Enunciado da Questão', 'Resposta Marcada', 'Gabarito Oficial', 'Resultado']],
          body: tableRows,
          theme: 'grid',
          styles: {
            font: 'helvetica',
            fontSize: 7.5,
            cellPadding: 2.5,
            overflow: 'linebreak'
          },
          headStyles: {
            fillColor: [15, 23, 42],
            textColor: [250, 204, 21],
            fontStyle: 'bold',
            halign: 'left'
          },
          columnStyles: {
            0: { cellWidth: 8, halign: 'center' },
            1: { cellWidth: 70 },
            2: { cellWidth: 42 },
            3: { cellWidth: 42 },
            4: { cellWidth: 20, halign: 'center', fontStyle: 'bold' }
          },
          didParseCell: function(data) {
            if (data.section === 'body' && data.column.index === 4) {
              if (data.cell.raw === 'CORRETO') {
                data.cell.styles.textColor = [16, 185, 129];
              } else {
                data.cell.styles.textColor = [239, 68, 68];
              }
            }
          },
          margin: { left: 14, right: 14 }
        });
      } else {
        doc.setFontSize(10);
        doc.setTextColor(148, 163, 184);
        doc.text('Detalhamento questão por questão não disponível para esta avaliação.', 14, 85);
      }

      // Rodapé
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Garden Gold Academia • Avaliação Oficial de Anatomia e Cinesiologia • Página ${i} de ${pageCount}`,
          14,
          290
        );
      }

      const safeName = candName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      doc.save(`avaliacao_garden_gold_${safeName}.pdf`);
      playSuccessSound();
    } catch (err) {
      console.error('Erro ao gerar PDF do candidato:', err);
      alert('Erro ao gerar o PDF individual do aluno.');
    }
  }

  // --- Exportar Relatório do Candidato Atual da Tela de Resultados ---
  function exportCurrentCandidateResultPdf() {
    const candidateAnswers = [];
    questions.forEach((q, idx) => {
      const uAns = userAnswers[idx];
      candidateAnswers.push({
        q_num: idx + 1,
        question: q.question,
        selected: uAns !== undefined && uAns.selectedIndex !== undefined ? q.options[uAns.selectedIndex] : 'Em branco',
        correct: q.options[q.correctIndex],
        is_correct: uAns ? uAns.isCorrect : false
      });
    });

    let correctCount = 0;
    questions.forEach((q, idx) => {
      if (userAnswers[idx] && userAnswers[idx].isCorrect) correctCount++;
    });

    const currentEval = {
      candidate_name: candidateName || 'Candidato',
      created_at: examStartTime ? examStartTime.toISOString() : new Date().toISOString(),
      score: correctCount,
      total: questions.length,
      percentage: Math.round((correctCount / questions.length) * 100),
      mode: mode,
      answers: candidateAnswers
    };

    exportCandidatePdf(currentEval);
  }

  // --- Exportar para Planilha Excel (CSV) ---
  function exportToCsv() {
    if (!allEvaluationsCache || allEvaluationsCache.length === 0) {
      alert('Não há dados para exportar.');
      return;
    }

    let csvContent = '\uFEFF'; // BOM para garantir acentos corretos no Excel brasileiro
    csvContent += 'Data;Nome do Candidato;Acertos;Total;Porcentagem\n';

    allEvaluationsCache.forEach(item => {
      const dateStr = item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : '';
      const name = (item.candidate_name || '').replace(/;/g, ' ');
      csvContent += `"${dateStr}";"${name}";"${item.score}";"${item.total}";"${item.percentage}%"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_participantes_garden_gold_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // --- Reiniciar para Novo Participante ---
  function resetForNewParticipant() {
    candidateName = '';
    studentNameInput.value = '';
    currentIndex = 0;
    userAnswers = {};

    resultScreen.classList.remove('active');
    quizArea.style.display = 'none';
    quizTopBar.style.display = 'none';
    welcomeScreen.style.display = 'flex';

    setTimeout(() => studentNameInput.focus(), 200);
  }

  function restartCurrentQuiz() {
    currentIndex = 0;
    userAnswers = {};
    resultScreen.classList.remove('active');
    quizArea.style.display = 'grid';
    quizTopBar.style.display = 'flex';
    renderQuestion(currentIndex);
    updateScoreDisplay();
  }

  // --- Lightbox Modal ---
  function openLightbox(src, caption) {
    lightboxImg.src = src;
    lightboxCaption.textContent = caption || 'Visualização da Imagem';
    lightbox.classList.add('active');
  }

  function closeLightbox() {
    lightbox.classList.remove('active');
    lightboxImg.src = '';
  }

  // --- Event Listeners ---
  function setupEventListeners() {
    formStartQuiz.addEventListener('submit', (e) => {
      e.preventDefault();
      handleStartQuiz();
    });

    btnPrev.addEventListener('click', () => {
      if (currentIndex > 0) {
        currentIndex--;
        renderQuestion(currentIndex);
        playClickSound();
      }
    });

    btnNext.addEventListener('click', () => {
      if (currentIndex < questions.length - 1) {
        currentIndex++;
        renderQuestion(currentIndex);
        playClickSound();
      } else {
        showResults();
      }
    });

    btnNewParticipant.addEventListener('click', resetForNewParticipant);
    btnRestart.addEventListener('click', restartCurrentQuiz);

    // Desbloqueio e Bloqueio do Aplicativo (Admin PIN)
    function handleUnlock() {
      const enteredPin = (appUnlockPin.value || '').trim();
      const expectedPin = (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.adminPin) ? String(window.SUPABASE_CONFIG.adminPin).trim() : '951233';

      if (enteredPin === expectedPin) {
        sessionStorage.setItem('garden_gold_unlocked', 'true');
        appLockScreen.classList.add('unlocked');
        unlockError.style.display = 'none';
        appUnlockPin.value = '';
        playSuccessSound();
        tryEnableFullscreen();
        setTimeout(() => {
          if (studentNameInput) studentNameInput.focus();
        }, 250);
      } else {
        playErrorSound();
        unlockError.style.display = 'block';
        appUnlockPin.value = '';
        setTimeout(() => appUnlockPin.focus(), 100);
      }
    }

    const btnUnlockApp = document.getElementById('btn-unlock-app');
    if (btnUnlockApp) {
      btnUnlockApp.addEventListener('click', (e) => {
        e.preventDefault();
        handleUnlock();
      });
      btnUnlockApp.addEventListener('touchend', (e) => {
        e.preventDefault();
        handleUnlock();
      });
    }

    if (formUnlockApp) {
      formUnlockApp.addEventListener('submit', (e) => {
        e.preventDefault();
        handleUnlock();
      });
    }

    if (appUnlockPin) {
      appUnlockPin.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleUnlock();
        }
      });
    }

    btnLockApp.addEventListener('click', () => {
      sessionStorage.removeItem('garden_gold_unlocked');
      appLockScreen.classList.remove('unlocked');
      appUnlockPin.value = '';
      setTimeout(() => appUnlockPin.focus(), 250);
    });

    // Admin & Relatórios
    btnAdmin.addEventListener('click', openAdminPanel);
    adminModalClose.addEventListener('click', () => adminModal.classList.remove('active'));
    detailModalClose.addEventListener('click', () => detailModal.classList.remove('active'));
    btnRefreshReports.addEventListener('click', loadReportsData);
    btnExportCsv.addEventListener('click', exportToCsv);
    if (btnExportPdf) btnExportPdf.addEventListener('click', exportGeneralReportsPdf);
    if (btnExportCandidatePdf) {
      btnExportCandidatePdf.addEventListener('click', () => {
        if (currentSelectedCandidate) exportCandidatePdf(currentSelectedCandidate);
        else alert('Selecione um candidato para exportar.');
      });
    }
    if (btnExportResultPdf) {
      btnExportResultPdf.addEventListener('click', exportCurrentCandidateResultPdf);
    }

    adminSearch.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      const filtered = allEvaluationsCache.filter(item => 
        (item.candidate_name || '').toLowerCase().includes(query)
      );
      renderAdminTable(filtered);
    });

    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox || e.target === document.getElementById('lightbox-content')) {
        closeLightbox();
      }
    });

    btnToggleMode.addEventListener('click', () => {
      const pin = prompt('Digite a senha de administrador (951233) para alterar o modo:');
      const expectedPin = (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.adminPin) ? window.SUPABASE_CONFIG.adminPin : '951233';

      if (pin !== expectedPin) {
        if (pin !== null && pin !== '') {
          playErrorSound();
          alert('Senha incorreta. Alteração de modo bloqueada.');
        }
        return;
      }

      mode = (mode === 'exam') ? 'study' : 'exam';
      updateModeDisplay();
      if (welcomeScreen.style.display === 'none') {
        renderQuestion(currentIndex);
      }
      playSuccessSound();
      alert(`Modo alterado com sucesso para: ${mode === 'exam' ? 'Modo Avaliação (resultado no final)' : 'Modo Estudo (feedback imediato)'}`);
    });

    btnSound.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      btnSound.style.opacity = soundEnabled ? '1' : '0.4';
      if (soundEnabled) playSuccessSound();
    });

    btnTheme.addEventListener('click', () => {
      document.body.classList.toggle('light-theme');
      localStorage.setItem('quiz_theme', document.body.classList.contains('light-theme') ? 'light' : 'dark');
    });

    if (localStorage.getItem('quiz_theme') === 'light') {
      document.body.classList.add('light-theme');
    }

    btnFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      }
    });

    fileLoader.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (Array.isArray(parsed) && parsed.length > 0) {
            questions = parsed;
            quizTotalCount.textContent = `Total de questões carregadas: ${questions.length}`;
            resetForNewParticipant();
            alert(`Carregadas ${questions.length} questões com sucesso!`);
          } else {
            alert('O arquivo selecionado não contém uma lista válida de questões.');
          }
        } catch (err) {
          alert('Erro ao interpretar o arquivo JSON: ' + err.message);
        }
      };
      reader.readAsText(file);
    });
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
