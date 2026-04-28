import React, { createContext, useContext, useState } from 'react'
import type { Lang } from './translations'
import { T, LANG_LABELS } from './translations'

interface LangCtx {
  lang: Lang
  setLang: (l: Lang) => void
  t: typeof T[Lang]
}

const LanguageContext = createContext<LangCtx>({
  lang: 'kk',
  setLang: () => {},
  t: T.kk,
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const stored = localStorage.getItem('parking_lang') as Lang | null
    return (stored && ['kk', 'ru', 'en'].includes(stored)) ? stored : 'kk'
    } catch {
      return 'kk'
    }
  })

  function setLang(l: Lang) {
    setLangState(l)
    try { localStorage.setItem('parking_lang', l) } catch {}
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: T[lang] }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() {
  return useContext(LanguageContext)
}

export { LANG_LABELS }
