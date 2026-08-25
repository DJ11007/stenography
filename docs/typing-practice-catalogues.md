# Typing practice catalogues

The Practice area has two canonical categories: English Typing and Hindi Typing.

Managed catalogues query only published, public, non-live tests. Typing catalogues use `mode = practice`; stenography catalogues use `mode = stenography`. Every query also specifies its language, and Hindi selections add an exact `input_system_id` filter. Test cards link to the immutable managed-test runner, preserving the saved font, keyboard layout, passage, and scoring configuration.

Word Efficiency and Stenography are each a separate top-level area, linked directly from the Typing Hub (`/typing`) rather than listed as Practice categories, since both have their own language-selector flow: `/typing/word-efficiency` and `/typing/practice/stenography` respectively. The Stenography selector routes into `/typing/practice/english-stenography` and `/typing/practice/hindi-stenography`, which remain live, addressable routes — they are no longer listed as Practice category cards, but the pages and their managed-test catalogues are unchanged. Excel has a stable catalogue route (`/typing/practice/excel-efficiency`) ready for a future exercise type; until that module exists it renders an intentional Coming Soon page and is not linked from either the Hub or Practice navigation.

Legacy branded URLs are permanent redirects in `next.config.ts`. Internal legacy IDs and local-storage keys remain unchanged for scoring and preference compatibility; they must not be used as student-facing labels.
