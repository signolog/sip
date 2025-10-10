// Custom ok icon'u oluştur
const arrowIcon = `data:image/svg+xml;base64,${btoa(`
      <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <polygon points="12,2 22,12 17,12 17,22 7,22 7,12 2,12" fill="#FF6B35" stroke="#FFFFFF" stroke-width="2"/>
      </svg>
    `)}`;

const elevatorIcon = `data:image/svg+xml;base64,${btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72">
      <rect x="2.962" y="0.744" width="66.601" height="64.815" style="fill: rgb(232, 232, 232); stroke: rgb(0, 0, 0);" rx="26.077" ry="26.077"></rect>
      <ellipse style="fill: rgb(0, 0, 0);" cx="36.48" cy="19.899" rx="4.064" ry="4.168"></ellipse>
      <polygon style="fill: rgb(0, 0, 0); stroke: rgb(0, 0, 0);" points="18.224 51.205 28.779 51.205 48.334 32.565 55.166 32.735 55.166 24.821 44.611 24.821 26.138 43.287 18.224 43.287"></polygon>
      <polygon style="fill: rgb(0, 0, 0);" points="31.42 33.223 31.417 24.821 41.973 24.821 31.417 35.373"></polygon>
      <polyline style="fill: rgb(0, 0, 0); stroke: rgb(0, 0, 0);" points="29.058 65.532 36.003 71.485 43.468 65.549"></polyline>
    </svg>
  `)}`;

export { arrowIcon, elevatorIcon };
