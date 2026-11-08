// Configuração do Tailwind para gerar o CSS fixo do jogo (tools/gerar-css.sh).
// Mesmas cores e fontes que a página usava com o Tailwind do CDN.
module.exports = {
  content: ['./prototipo/ponto-alpha.html', './prototipo/assets/js/*.js'],
  theme: {
    extend: {
      colors: {
        mil: {
          bg: '#0c0f0d',
          panel: '#131815',
          border: '#27332b',
          borderDark: '#1a221d',
          olive: '#3e4c3a',
          oliveDark: '#283226',
          greenMuted: '#5a7356',
          amberMuted: '#b37d2e',
          redAlert: '#8a2b2b',
          redDark: '#4a1717',
          komonaBlue: '#3b5266',
          textGlow: '#8fad88',
          textMuted: '#b3c4ae'
        }
      },
      fontFamily: {
        mono: ['"Courier Prime"', 'monospace'],
        typewriter: ['"Special Elite"', 'cursive']
      }
    }
  }
};
