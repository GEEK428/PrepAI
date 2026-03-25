const fs = require('fs');

// Fix Auth Mobile (Login/Register)
let authCss = fs.readFileSync('Frontend/src/features/auth/auth.form.scss', 'utf8');
if (!authCss.includes('MOBILE FIXES')) {
    authCss += `

/* MOBILE FIXES */
@media (max-width: 850px) {
    .auth-page--login .auth-shell,
    .auth-page--register .auth-shell,
    .auth-page--forgot .auth-shell {
        grid-template-columns: 1fr !important;
        grid-template-rows: auto 1fr;
        max-height: unset;
        min-height: 100vh;
        border-radius: 0;
    }
    
    .auth-hero {
        padding: 2rem 1.5rem !important;
    }
    
    .hero-points--cards {
        display: flex;
        flex-wrap: wrap;
    }
}
`;
    fs.writeFileSync('Frontend/src/features/auth/auth.form.scss', authCss);
}

// Fix Dashboard Header Mobile Cramping
let homeCss = fs.readFileSync('Frontend/src/features/interview/style/home.scss', 'utf8');
if (!homeCss.includes('HEADER CRAMP FIX')) {
    homeCss += `

/* HEADER CRAMP FIX */
@media (max-width: 850px) {
    .dashboard-header {
        flex-direction: column !important;
        align-items: flex-start !important;
        gap: 1rem;
        margin-bottom: 0.5rem;
    }
    .dashboard-header > div {
        width: 100%;
    }
    .dashboard-subtitle {
        max-width: 100% !important;
        line-height: 1.5 !important;
        font-size: 0.8rem;
    }
}
`;
    fs.writeFileSync('Frontend/src/features/interview/style/home.scss', homeCss);
}
console.log("CSS Mobile adjustments applied");
