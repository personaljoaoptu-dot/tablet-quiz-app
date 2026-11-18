// Arquivo de questões (pode ser editado diretamente ou sincronizado com questions.json)
// Cada pergunta pode conter 1 ou mais imagens.
// As imagens podem ser informadas como string ("images/foto.jpg") ou objeto ({ src: "images/foto.jpg", caption: "Legenda" }).

window.QUIZ_QUESTIONS = [
  {
    id: 1,
    question: "Observe as duas imagens abaixo e identifique qual é o sistema representado:",
    images: [
      {
        src: "images/exemplo1.svg",
        caption: "Figura 1: Vista esquemática geral"
      },
      {
        src: "images/exemplo2.svg",
        caption: "Figura 2: Detalhe estrutural"
      }
    ],
    options: [
      "Sistema Circulatório",
      "Sistema Respiratório",
      "Sistema Nervoso Central",
      "Sistema Digestório"
    ],
    correctIndex: 0,
    explanation: "As ilustrações demonstram a circulação e as ramificações vasculares principais."
  },
  {
    id: 2,
    question: "Analisando a imagem a seguir, qual é o padrão observado?",
    images: [
      "images/exemplo3.svg"
    ],
    options: [
      "Padrão Linear Crescente",
      "Padrão Cíclico / Periódico",
      "Distribuição Aleatória",
      "Padrão Exponencial Invertido"
    ],
    correctIndex: 1,
    explanation: "O gráfico demonstra oscilações regulares que caracterizam periodicidade."
  },
  {
    id: 3,
    question: "Compare os três exemplos visuais abaixo. Qual deles apresenta a configuração correta para estabilidade?",
    images: [
      { src: "images/exemplo1.svg", caption: "Amostra A" },
      { src: "images/exemplo2.svg", caption: "Amostra B" },
      { src: "images/exemplo3.svg", caption: "Amostra C" }
    ],
    options: [
      "Apenas a Amostra A",
      "Apenas a Amostra B",
      "Apenas a Amostra C",
      "Todas as amostras são equivalentes"
    ],
    correctIndex: 2,
    explanation: "A Amostra C possui a distribuição de forças ideal de acordo com os princípios demonstrados."
  }
];
