const fs = require('fs');

const desktopCss = `

/* DESKTOP UX OVERHAUL: Right-side panel for Inspection Drawer */
@media (min-width: 1024px) {
  .drawer-container {
    top: 56px; /* Below header */
    bottom: 0 !important;
    left: auto;
    right: 0;
    width: 400px;
    height: auto !important;
    border-radius: 0;
    border-top: none;
    border-left: 1px solid var(--border-light);
    transform: translateX(100%);
    transition: transform 0.3s ease;
  }
  
  .drawer-container.expanded,
  .drawer-container.mid {
    transform: translateX(0) !important;
  }
  
  .drawer-container.collapsed,
  .drawer-container.hidden {
    transform: translateX(100%) !important;
  }
  
  .drawer-handle-bar {
    display: none; /* No drag handle on desktop */
  }
}
`;

fs.appendFileSync('styles.css', desktopCss);
console.log('Appended desktop CSS');
