/**
 * Quiz Tablet Pro - Mecânica da Aplicação Web
 */

(function () {
  'use strict';

  // --- Estado da Aplicação ---
  let questions = [];
  let currentIndex = 0;
  let userAnswers = {}; // { [qIndex]: { selectedIndex: number, isCorrect: boolean } }
  let mode = 'study'; // 'study' (mostra resposta na hora) ou 'exam' (apenas no final)
  let soundEnabled = true;

  // --- Elementos do DOM ---
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
  const quizArea = document.getElementById('quiz-area');
  const quizTopBar = document.getElementById('quiz-top-bar');
  const resultScreen = document.getElementById('result-screen');

  // Modais e Controles
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCaption = document.getElementById('lightbox-caption');
  const lightboxClose = document.getElementById('lightbox-close');
  const btnToggleMode = document.getElementById('btn-toggle-mode');
  const btnSound = document.getElementById('btn-sound');
  const btnTheme = document.getElementById('btn-theme');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const fileLoader = document.getElementById('file-loader');
  const btnRestart = document.getElementById('btn-restart');

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
    playTone(523.25, 0.12); // C5
    setTimeout(() => playTone(659.25, 0.15), 100); // E5
    setTimeout(() => playTone(783.99, 0.25), 200); // G5
  }

  function playErrorSound() {
    playTone(220, 0.15, 'sawtooth');
    setTimeout(() => playTone(180, 0.25, 'sawtooth'), 120);
  }

  function playClickSound() {
    playTone(400, 0.04);
  }

  // --- Inicialização e Carga de Questões ---
  async function initApp() {
    setupEventListeners();
    await loadQuestions();
  }

  async function loadQuestions() {
    try {
      // Tenta buscar o arquivo questions.json
      const response = await fetch('questions.json');
      if (!response.ok) throw new Error('Falha ao carregar JSON');
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        questions = data;
      } else {
        throw new Error('Formato inválido');
      }
    } catch (err) {
      console.warn('Usando fallback window.QUIZ_QUESTIONS:', err);
      if (window.QUIZ_QUESTIONS && window.QUIZ_QUESTIONS.length > 0) {
        questions = window.QUIZ_QUESTIONS;
      } else {
        questionText.textContent = 'Nenhuma questão encontrada no arquivo questions.json ou questions.js.';
        return;
      }
    }

    currentIndex = 0;
    userAnswers = {};
    renderQuestion(currentIndex);
    updateScoreDisplay();
  }

  // --- Renderização da Questão ---
  function renderQuestion(index) {
    if (!questions || questions.length === 0) return;
    const q = questions[index];

    // Atualiza Barra de Progresso
    questionBadge.textContent = `Questão ${index + 1} de ${questions.length}`;
    const progressPercent = ((index + 1) / questions.length) * 100;
    progressFill.style.width = `${progressPercent}%`;

    // Atualiza Enunciado
    questionText.textContent = q.question;

    // Renderiza Imagens (1, 2 ou mais)
    renderImages(q.images);

    // Renderiza Alternativas
    renderOptions(q, index);

    // Atualiza Feedback Box se já foi respondida
    updateFeedbackBox(index);

    // Controles de Navegação
    btnPrev.disabled = index === 0;
    
    if (mode === 'study') {
      btnNext.disabled = userAnswers[index] === undefined;
    } else {
      btnNext.disabled = false;
    }

    btnNext.textContent = (index === questions.length - 1) ? 'Finalizar Simulado ✓' : 'Próxima Questão →';
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
      // Suporta formato direto string ou objeto com legenda
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

  // --- Manipulação da Escolha do Usuário ---
  function handleSelectOption(qIndex, selectedIndex) {
    const q = questions[qIndex];
    const isCorrect = selectedIndex === q.correctIndex;

    userAnswers[qIndex] = {
      selectedIndex,
      isCorrect
    };

    if (mode === 'study') {
      if (isCorrect) {
        playSuccessSound();
      } else {
        playErrorSound();
      }
      renderQuestion(qIndex);
      updateScoreDisplay();
    } else {
      // Modo Prova (Exam): Apenas registra e marca selecionado
      playClickSound();
      renderQuestion(qIndex);
    }
  }

  // --- Feedback Box (Explicação) ---
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
      feedbackTitle.innerHTML = '✓ Parabéns! Resposta Correta.';
    } else {
      feedbackBox.className = 'feedback-box active wrong';
      const correctLetter = OPTION_LETTERS[q.correctIndex] || (q.correctIndex + 1);
      feedbackTitle.innerHTML = `✕ Incorreto. A alternativa correta é a (${correctLetter}).`;
    }

    feedbackText.textContent = q.explanation || 'Sem explicação adicional cadastrada.';
  }

  // --- Atualização do Score ---
  function updateScoreDisplay() {
    let score = 0;
    Object.values(userAnswers).forEach(ans => {
      if (ans.isCorrect) score++;
    });
    scoreCounter.textContent = score;
  }

  // --- Finalização e Tela de Resultados ---
  function showResults() {
    quizArea.style.display = 'none';
    quizTopBar.style.display = 'none';
    resultScreen.classList.add('active');

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

    // Emoji de acordo com a nota
    const emojiEl = document.getElementById('result-emoji');
    if (percentage >= 80) emojiEl.textContent = '🏆';
    else if (percentage >= 60) emojiEl.textContent = '👍';
    else emojiEl.textContent = '📚';

    // Lista de Revisão
    const reviewList = document.getElementById('result-review-list');
    reviewList.innerHTML = '<h3 style="font-size:16px; margin-bottom:12px; font-weight:700;">Revisão de Todas as Questões:</h3>';

    questions.forEach((q, idx) => {
      const userAns = userAnswers[idx];
      const isRight = userAns && userAns.isCorrect;
      const userChoiceText = userAns ? q.options[userAns.selectedIndex] : 'Não respondida';
      const correctChoiceText = q.options[q.correctIndex];

      const item = document.createElement('div');
      item.className = `review-item ${isRight ? 'correct' : 'wrong'}`;
      item.innerHTML = `
        <div class="review-q">#${idx + 1}: ${q.question}</div>
        <div class="review-ans">Sua resposta: <strong>${userChoiceText}</strong> ${isRight ? '✓' : '✕'}</div>
        ${!isRight ? `<div class="review-ans" style="color:var(--success);">Correta: <strong>${correctChoiceText}</strong></div>` : ''}
        ${q.explanation ? `<div class="review-ans" style="margin-top:4px; font-style:italic;">Nota: ${q.explanation}</div>` : ''}
      `;
      reviewList.appendChild(item);
    });

    if (percentage >= 60) {
      playSuccessSound();
    }
  }

  function restartQuiz() {
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

  // --- Event Listeners Globais ---
  function setupEventListeners() {
    // Navegação
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

    btnRestart.addEventListener('click', restartQuiz);

    // Lightbox
    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox || e.target === document.getElementById('lightbox-content')) {
        closeLightbox();
      }
    });

    // Modo: Estudo vs Avaliação
    btnToggleMode.addEventListener('click', () => {
      mode = (mode === 'study') ? 'exam' : 'study';
      currentModeLabel.textContent = (mode === 'study') ? 'Treino' : 'Prova';
      renderQuestion(currentIndex);
      alert(`Modo alterado para: ${mode === 'study' ? 'Modo Treino (feedback imediato e explicação)' : 'Modo Prova (resultado apenas no final)'}`);
    });

    // Som
    btnSound.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      btnSound.style.opacity = soundEnabled ? '1' : '0.4';
      if (soundEnabled) playSuccessSound();
    });

    // Tema Claro / Escuro
    btnTheme.addEventListener('click', () => {
      document.body.classList.toggle('light-theme');
      const isLight = document.body.classList.contains('light-theme');
      localStorage.setItem('quiz_theme', isLight ? 'light' : 'dark');
    });

    if (localStorage.getItem('quiz_theme') === 'light') {
      document.body.classList.add('light-theme');
    }

    // Tela Cheia (Essencial para Tablet Android)
    btnFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
    });

    // Carregamento de arquivo JSON avulso pelo usuário
    fileLoader.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (Array.isArray(parsed) && parsed.length > 0) {
            questions = parsed;
            restartQuiz();
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

    // Teclas de atalho para tablet com teclado conectado (A, B, C, D, setas)
    window.addEventListener('keydown', (e) => {
      const key = e.key.toUpperCase();
      if (['A', 'B', 'C', 'D'].includes(key)) {
        const idx = key.charCodeAt(0) - 65;
        if (questions[currentIndex] && questions[currentIndex].options[idx]) {
          handleSelectOption(currentIndex, idx);
        }
      } else if (e.key === 'ArrowRight' && !btnNext.disabled) {
        btnNext.click();
      } else if (e.key === 'ArrowLeft' && !btnPrev.disabled) {
        btnPrev.click();
      }
    });
  }

  // Inicia a aplicação
  window.addEventListener('DOMContentLoaded', initApp);
})();
