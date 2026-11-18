/**
 * Avaliação Garden Gold - Mecânica da Aplicação Web para Tablet Android
 */

(function () {
  'use strict';

  // --- Estado da Aplicação ---
  let questions = [];
  let currentIndex = 0;
  let userAnswers = {}; // { [qIndex]: { selectedIndex: number, isCorrect: boolean } }
  let mode = 'exam'; // 'exam' (modo avaliação padrão) ou 'study' (treino com feedback na hora)
  let soundEnabled = true;
  let candidateName = '';
  let examStartTime = null;

  // --- Elementos do DOM ---
  const welcomeScreen = document.getElementById('welcome-screen');
  const studentNameInput = document.getElementById('student-name');
  const formStartQuiz = document.getElementById('form-start-quiz');
  const quizTotalCount = document.getElementById('quiz-total-count');
  const displayStudentName = document.getElementById('display-student-name');

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
  const btnNewParticipant = document.getElementById('btn-new-participant');
  const btnRestart = document.getElementById('btn-restart');

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

  // --- Efeitos Sonoros com Web Audio API (Offline & Instantâneo) ---
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

  // --- Inicialização ---
  async function initApp() {
    setupEventListeners();
    currentModeLabel.textContent = (mode === 'exam') ? 'Avaliação' : 'Treino';
    await loadQuestions();
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

    candidateName = name;
    displayStudentName.textContent = candidateName;
    examStartTime = new Date();
    currentIndex = 0;
    userAnswers = {};

    // Esconde tela inicial e exibe o teste
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

    if (mode === 'study') {
      btnNext.disabled = userAnswers[index] === undefined;
    } else {
      btnNext.disabled = userAnswers[index] === undefined;
    }

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
      // Modo Avaliação (Prova)
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

  // --- Finalização e Resultados ---
  function showResults() {
    quizArea.style.display = 'none';
    quizTopBar.style.display = 'none';
    resultScreen.classList.add('active');

    resultStudentName.textContent = candidateName || 'Não identificado';
    const now = new Date();
    resultDate.textContent = `Realizado em: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}`;

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

  // --- Próximo Candidato (Zera e volta para a tela de nome) ---
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

  // --- Lightbox Modal (Zoom de Imagens) ---
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

    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox || e.target === document.getElementById('lightbox-content')) {
        closeLightbox();
      }
    });

    btnToggleMode.addEventListener('click', () => {
      mode = (mode === 'exam') ? 'study' : 'exam';
      currentModeLabel.textContent = (mode === 'exam') ? 'Avaliação' : 'Treino';
      if (welcomeScreen.style.display === 'none') {
        renderQuestion(currentIndex);
      }
      alert(`Modo alterado para: ${mode === 'exam' ? 'Modo Avaliação (resultado no final)' : 'Modo Treino (feedback imediato)'}`);
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

  window.addEventListener('DOMContentLoaded', initApp);
})();
