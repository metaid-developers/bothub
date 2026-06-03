import { LanguageIcon } from '@heroicons/react/24/outline'
import { languageOptions, setLanguage, t, useLanguage, type SupportedLanguage } from '@/i18n'

export function LanguageSelect() {
  const [language] = useLanguage()

  return (
    <label className="group inline-flex items-center gap-2 rounded-lg border border-hub-border bg-hub-surface2 px-2.5 py-1.5 text-sm text-white transition-colors hover:border-hub-accent/40 hover:bg-hub-accent/10">
      <LanguageIcon
        className="h-4 w-4 text-hub-muted transition-colors group-hover:text-hub-accent"
        aria-hidden
      />
      <span className="sr-only">{t('language.label')}</span>
      <select
        aria-label={t('language.label')}
        value={language}
        onChange={(event) => setLanguage(event.target.value as SupportedLanguage)}
        className="cursor-pointer bg-transparent text-xs font-semibold text-white outline-none"
      >
        {languageOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {t(option.labelKey)}
          </option>
        ))}
      </select>
    </label>
  )
}
