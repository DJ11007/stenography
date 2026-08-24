# Typing practice catalogues

The Practice area has six canonical categories: English Typing, Hindi Typing, English Stenography, Hindi Stenography, Word Efficiency, and Excel Efficiency.

Managed catalogues query only published, public, non-live tests. Typing catalogues use `mode = practice`; stenography catalogues use `mode = stenography`. Every query also specifies its language, and Hindi selections add an exact `input_system_id` filter. Test cards link to the immutable managed-test runner, preserving the saved font, keyboard layout, passage, and scoring configuration.

Word and Excel have stable catalogue routes ready for future exercise types. Until those modules exist, their routes render intentional Coming Soon pages.

Legacy branded URLs are permanent redirects in `next.config.ts`. Internal legacy IDs and local-storage keys remain unchanged for scoring and preference compatibility; they must not be used as student-facing labels.
