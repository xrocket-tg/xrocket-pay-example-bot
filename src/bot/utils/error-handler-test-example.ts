import { ErrorHandler, ErrorType } from "./error-handler";
import { ValidationService } from "./validation";
import { formatCurrency, formatNumberClean } from "./formatters";

/**
 * TEST EXAMPLE: Demonstrating improved error message formatting
 * This shows how numbers are now properly formatted in error messages
 */

// Test the new number formatting functions
console.log('=== Number Formatting Tests ===');
console.log('formatCurrency(100.05):', formatCurrency(100.05)); // "100.05"
console.log('formatCurrency(3.21000000):', formatCurrency(3.21000000)); // "3.21"
console.log('formatCurrency(100.00000000):', formatCurrency(100.00000000)); // "100"
console.log('formatCurrency(0.00100000):', formatCurrency(0.00100000)); // "0.001"

// Test the number formatting in error messages
const errorHandler = ErrorHandler.getInstance();

console.log('\n=== Error Message Formatting Tests ===');

// Test 1: Original error message with trailing zeros
const originalError = "❌ Insufficient balance. You need 100.05 TON (100 + 0.05 fee), but have 3.21000000 TON.";
const formattedError = errorHandler['formatNumbersInMessage'](originalError);
console.log('Original:', originalError);
console.log('Formatted:', formattedError);
// Expected: "❌ Insufficient balance. You need 100.05 TON (100 + 0.05 fee), but have 3.21 TON."

// Test 2: Another example with multiple numbers
const originalError2 = "❌ Transfer failed. Amount: 50.00000000, Fee: 0.00100000, Total: 50.00100000";
const formattedError2 = errorHandler['formatNumbersInMessage'](originalError2);
console.log('\nOriginal:', originalError2);
console.log('Formatted:', formattedError2);
// Expected: "❌ Transfer failed. Amount: 50, Fee: 0.001, Total: 50.001"

// Test 3: Error with whole numbers
const originalError3 = "❌ Invalid amount: 100.00000000";
const formattedError3 = errorHandler['formatNumbersInMessage'](originalError3);
console.log('\nOriginal:', originalError3);
console.log('Formatted:', formattedError3);
// Expected: "❌ Invalid amount: 100"

/**
 * EXAMPLE: How error messages now look in the bot
 * 
 * BEFORE (with trailing zeros):
 * ❌ Insufficient balance. You need 100.05 TON (100 + 0.05 fee), but have 3.21000000 TON.
 * 
 * AFTER (clean formatting):
 * ❌ Insufficient balance. You need 100.05 TON (100 + 0.05 fee), but have 3.21 TON.
 * 
 * The error message will also include a "Main Menu" button that allows users to navigate back.
 */

/**
 * IMPROVEMENTS ACHIEVED:
 * 
 * 1. **Number Formatting**: All numbers in error messages are now formatted to remove trailing zeros
 * 2. **Main Menu Button**: All error messages now include a "Main Menu" button for easy navigation
 * 3. **Consistent Formatting**: All error messages use the same formatting logic
 * 4. **Better User Experience**: Cleaner, more readable error messages
 * 5. **Automatic Processing**: Number formatting happens automatically in the Error Handler
 */

/**
 * USAGE IN CONVERSATIONS:
 * 
 * The Error Handler now automatically formats all error messages, so no changes are needed
 * in the conversation files. The formatting happens transparently when errors are thrown:
 * 
 * ```typescript
 * // This will automatically format numbers in the error message
 * throw new Error("❌ Insufficient balance. You need 100.05 TON (100 + 0.05 fee), but have 3.21000000 TON.");
 * 
 * // The Error Handler will format it to:
 * // "❌ Insufficient balance. You need 100.05 TON (100 + 0.05 fee), but have 3.21 TON."
 * // And show it with a Main Menu button
 * ```
 */ 