const BROWSER_ID_KEY = 'tubeparty_browser_id';

export const getBrowserId = (): string => {
    let browserId = localStorage.getItem(BROWSER_ID_KEY);

    if (!browserId) {
        // Generate new unique browser ID
        browserId = `browser-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem(BROWSER_ID_KEY, browserId);
    }

    return browserId;
};
