import { InlineKeyboard } from "grammy";

export function createLanguageKeyboard() {
    return new InlineKeyboard()
        .text('🇬🇧 English', 'setlang_en')
        .text('🇷🇺 Русский', 'setlang_ru');
} 