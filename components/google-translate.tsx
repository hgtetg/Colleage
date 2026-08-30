'use client';

import { Languages } from 'lucide-react';
import { useEffect } from 'react';

declare global {
  interface Window {
    google?: {
      translate?: {
        TranslateElement: new (
          options: Record<string, unknown>,
          id: string,
        ) => void;
      };
    };
    campusGoogleTranslateInit?: () => void;
  }
}

export default function GoogleTranslate() {
  useEffect(() => {
    window.campusGoogleTranslateInit = () => {
      if (window.google?.translate?.TranslateElement)
        new window.google.translate.TranslateElement(
          {
            pageLanguage: 'en',
            includedLanguages: 'en,ar',
            autoDisplay: false,
          },
          'google_translate_element',
        );
    };
    if (!document.querySelector('script[data-campus-translate]')) {
      const script = document.createElement('script');
      script.src =
        'https://translate.google.com/translate_a/element.js?cb=campusGoogleTranslateInit';
      script.async = true;
      script.dataset.campusTranslate = 'true';
      document.head.appendChild(script);
    }
  }, []);
  const choose = () => {
    const next = document.cookie.includes('googtrans=/en/ar') ? 'en' : 'ar';
    const value = next === 'ar' ? '/en/ar' : '/en/en';
    document.cookie = `googtrans=${value};path=/;SameSite=Lax`;
    const select = document.querySelector(
      '.goog-te-combo',
    ) as HTMLSelectElement | null;
    if (select) {
      select.value = next;
      select.dispatchEvent(new Event('change'));
      document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
    } else {
      window.location.reload();
    }
  };
  return (
    <div className="google-translate-control notranslate">
      <div id="google_translate_element" />
      <button
        type="button"
        onClick={choose}
        aria-label="Switch between English and Arabic using Google Translate"
      >
        <Languages size={16} />
        English / العربية
      </button>
    </div>
  );
}
