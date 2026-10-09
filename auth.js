window.addEventListener('load', async function () {
    const actions = document.getElementById('auth-actions');
    const profile = document.getElementById('auth-user');
    const status = document.getElementById('auth-status');
    const retry = document.getElementById('auth-retry');
    const signIn = document.getElementById('sign-in-btn');
    const signUp = document.getElementById('sign-up-btn');
    const authScreen = document.getElementById('auth-screen');
    const quoteApp = document.getElementById('quote-app');
    const selector = document.getElementById('tool-selector');
    const caucion = document.getElementById('caucion-tool');
    const art = document.getElementById('art-tool');
    const navigation = document.getElementById('tool-navigation');
    const title = document.getElementById('tool-title');
    const caucionActions = document.getElementById('caucion-actions');
    const artActions = document.getElementById('art-actions');
    let profileMounted = false;
    let activeUserId = null;

    // Cambiar de pantalla sin recrear el formulario ni perder la cotización.
    function showTool(tool, moveFocus = false) {
        selector.hidden = tool !== 'home';
        caucion.hidden = tool !== 'caucion';
        art.hidden = tool !== 'art';
        navigation.hidden = tool === 'home';
        caucionActions.hidden = tool !== 'caucion';
        artActions.hidden = tool !== 'art';
        if (tool === 'art') window.openArtTool?.();
        title.textContent = tool === 'home' ? 'Cotizadores de seguros'
            : tool === 'caucion' ? 'Cotizador de Seguros de Caución' : 'Cotizador de ART';
        if (moveFocus) {
            const heading = tool === 'home' ? document.getElementById('tools-title')
                : tool === 'art' ? document.getElementById('art-title') : title;
            heading.focus();
        }
    }

    document.getElementById('open-caucion-btn').addEventListener('click', () => showTool('caucion', true));
    document.getElementById('open-art-btn').addEventListener('click', () => showTool('art', true));
    document.getElementById('back-to-tools-btn').addEventListener('click', () => showTool('home', true));
    showTool('home');

    quoteApp.hidden = true;
    authScreen.hidden = false;

    retry.addEventListener('click', () => window.location.reload());

    try {
        if (!window.Clerk) {
            const key = window.clerkPublishableKey;
            if (!/^pk_(test|live)_/.test(key || '')) {
                throw new Error('Falta configurar la clave pública de Clerk.');
            }
            const domain = atob(key.split('_')[2]).replace(/\$$/, '');
            if (!/^[a-z0-9.-]+$/.test(domain)) {
                throw new Error('Dominio de Clerk inválido.');
            }
            // Cargar los componentes y el SDK desde el dominio de la aplicación.
            for (const path of ['@clerk/ui@1/dist/ui.browser.js', '@clerk/clerk-js@6/dist/clerk.browser.js']) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = `https://${domain}/npm/${path}`;
                    script.crossOrigin = 'anonymous';
                    script.dataset.clerkPublishableKey = key;
                    const timeout = window.setTimeout(() => reject(new Error('Tiempo de espera de Clerk agotado.')), 15000);
                    script.onload = () => { window.clearTimeout(timeout); resolve(); };
                    script.onerror = () => { window.clearTimeout(timeout); reject(new Error('No se pudo cargar Clerk.')); };
                    document.head.appendChild(script);
                });
            }
        }

        const clerk = window.Clerk;
        await clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor } });
        signIn.addEventListener('click', () => clerk.openSignIn());
        signUp.addEventListener('click', () => clerk.openSignUp());
        signIn.disabled = false;
        signUp.disabled = false;
        status.hidden = true;
        retry.hidden = true;

        function updateControls({ user }) {
            const userId = user ? user.id : null;
            if (userId !== activeUserId) {
                showTool('home');
                activeUserId = userId;
            }
            quoteApp.hidden = !user;
            authScreen.hidden = Boolean(user);
            actions.hidden = Boolean(user);
            profile.hidden = !user;
            if (user && !profileMounted) {
                clerk.mountUserButton(profile);
                profileMounted = true;
            } else if (!user && profileMounted) {
                clerk.unmountUserButton(profile);
                profileMounted = false;
            }
        }

        updateControls({ user: clerk.user });
        clerk.addListener(updateControls);
    } catch (error) {
        quoteApp.hidden = true;
        authScreen.hidden = false;
        signIn.disabled = true;
        signUp.disabled = true;
        status.textContent = 'No se pudo conectar con el servicio de cuentas.';
        status.hidden = false;
        retry.hidden = false;
        console.error('Error de autenticación:', error);
    }
});
