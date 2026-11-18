# 📱 Quiz Tablet Pro

Aplicativo web de múltipla escolha com suporte a múltiplas imagens por questão, desenvolvido sob medida para **Tablets Android** (touch amigável, botões largos, tela cheia, modo paisagem/retrato e zoom em imagens).

---

## 🚀 Como testar no computador ou no tablet

### 1. No Computador (Imediato)
Basta dar duplo clique em `index.html` para abrir diretamente no navegador.

### 2. No Tablet Android (Pela rede Wi-Fi local)
1. Dê dois cliques no arquivo **`iniciar-servidor.bat`** (ele iniciará o servidor na porta 8080 e mostrará seu endereço de IP).
2. No seu tablet Android (conectado na mesma rede Wi-Fi do computador), abra o Chrome e digite:
   ```text
   http://SEU_IP:8080
   ```
   *(Exemplo: `http://192.168.1.15:8080`)*
3. **Instalar como App no Tablet**:
   - No Chrome do tablet, toque nos 3 pontinhos no canto superior direito e selecione **"Adicionar à tela inicial"** ou **"Instalar aplicativo"**.
   - O aplicativo abrirá em **tela cheia real**, sem barras de endereço, como um app nativo!

---

## 📂 Como cadastrar suas perguntas e imagens

Todas as perguntas ficam no arquivo **`questions.json`** (e no **`questions.js`** se preferir editar como JavaScript).
Coloque seus arquivos de imagem (PNG, JPG, SVG, WebP) dentro da pasta **`images/`**.

### Formato de cada questão:

```json
[
  {
    "id": 1,
    "question": "Enunciado da sua pergunta aqui?",
    "images": [
      {
        "src": "images/sua_foto_1.jpg",
        "caption": "Figura 1: Vista frontal"
      },
      {
        "src": "images/sua_foto_2.jpg",
        "caption": "Figura 2: Detalhe aproximado"
      }
    ],
    "options": [
      "Primeira alternativa",
      "Segunda alternativa",
      "Terceira alternativa",
      "Quarta alternativa"
    ],
    "correctIndex": 0,
    "explanation": "Explicação opcional de por que a alternativa A é a correta."
  }
]
```

### 💡 Dicas sobre as imagens:
- **1 imagem só**: Pode usar `"images": ["images/foto.jpg"]` ou com legenda `[{"src": "images/foto.jpg", "caption": "Legenda"}]`. A imagem ficará em destaque.
- **2 ou mais imagens**: A aplicação ajusta automaticamente o layout em grade responsiva (lado a lado no tablet).
- **Zoom / Detalhe**: Qualquer imagem tocada na tela abre imediatamente em tela cheia (lightbox) com alta resolução.

---

## ⚙️ Recursos Inclusos:
- **Modo Treino vs Prova**: No ícone da barra superior você pode alternar se o app deve mostrar o feedback na hora (modo estudo) ou apenas no final (modo simulado/prova).
- **Efeitos Sonoros Offline**: Tons sonoros sintetizados via Web Audio API (não necessita de conexão com a internet).
- **Modo Escuro / Claro**: Botão de alternar tema com memorização.
- **Carregar arquivo externo**: Pelo ícone de nuvem na barra superior, é possível carregar qualquer arquivo `.json` salvo no tablet a qualquer momento.
