import { InlineKeyboard } from "grammy";
import { UserCheque } from "../../entities/user-cheque";

/**
 * Creates inline keyboard for cheque details
 */
export function createChequeDetailKeyboard(cheque: UserCheque): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    
    // Add "Open Cheque" button if we have a link
    if (cheque.link) {
        keyboard.url("🔗 Open Cheque", cheque.link);
    }
    
    keyboard.row().text("🏠 Main Menu", "main_menu");
    
    return keyboard;
} 