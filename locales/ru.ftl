main-welcome = 
    🤖 <b>Информация о демо-боте</b>

    Это демо-бот для демонстрации возможностей xRocket Pay: платежного API от @xRocket bot

    📚 <b>Ресурсы:</b>
    • Исходный код: <a href="https://github.com/xrocket-tg/xrocket-pay-example-bot">GitHub Repository</a>
    • TypeScript SDK: <a href="https://www.npmjs.com/package/xrocket-pay-api-sdk">npm Package</a>
    • Документация API: <a href="https://pay.xrocket.tg/api#/">Swagger UI</a>
    • Схема API: <a href="https://pay.xrocket.tg/api-json">OpenAPI JSON</a>

    ⚠️ <b>Предупреждение:</b> Этот бот создан для тестирования. Если вы хотите использовать этот код в продакшене, делайте это на свой страх и риск.

    🐛 <b>Поддержка:</b>
    • Сообщить об ошибках: <a href="https://github.com/xrocket-tg/xrocket-pay-example-bot/issues">GitHub Issues</a>
    • Присоединиться к чату: <a href="https://t.me/+mA9IoHSdvIRhZjFi">Telegram Community</a>

    ----------------------

main-menu = Главное меню

language-select = 
    🌐 Please select your language:
    Пожалуйста, выберите язык:
language-changed = Язык успешно изменен!

balance-title = 💰 Ваш баланс:
balance-no-balance = Пока нет балансов
balance-currency-format = { $emoji } { $name }: { $amount }

deposit-select-currency = 
    💱 Выберите валюту для пополнения:

    💡 <i>Примечание: Если у вас есть продукты с известными ценами, вы можете пропустить этот шаг и предложить пользователям ваши продукты напрямую с ценами, а затем перейти к созданию инвойса.</i>

deposit-enter-amount = 
    💵 Введите сумму для пополнения в { $emoji } { $name }:

    💡 <i>Примечание: Если у вас есть продукты с известными ценами, вы можете пропустить этот шаг и предложить пользователям ваши продукты напрямую с ценами, а затем перейти к созданию инвойса.</i>
deposit-creating-invoice = ⏳ Создание инвойса...
deposit-invoice-created = 
    💳 Инвойс успешно создан!

    💰 Сумма: { $amount } { $emoji } { $name }
    🆔 ID инвойса: { $invoiceId }
    📅 Создан: { $createdAt }

    💳 Оплатите этот инвойс, чтобы пополнить баланс.
deposit-payment-info = 

    💡 Обработка платежа:
    • Нажмите 'Проверить платеж' для ручной проверки оплаты инвойса
    • Или дождитесь автоматической обработки через вебхук
    • Статус платежа обновится автоматически

withdrawal-select-type = 
    💸 <b>Выберите способ вывода</b>

    🚀 <b>xRocket бот имеет 3 способа отправки платежей вашим пользователям:</b>

    💬 <b>1. Переводы</b>
    Лучше всего, если вы знаете telegram ID и пользователь уже в @xRocket. Они получат платеж и сообщение прямо в боте. Если вы отправите слишком маленькую сумму, название приложения изменится на "Some App". Это было сделано для предотвращения спама.

    🎫 <b>2. Чеки</b>
    Если вы не уверены, что пользователь когда-либо запускал xRocket, вы можете доставить им криптовалюту с помощью чеков. Пользователю нужно будет нажать на ссылку чека, чтобы активировать его. Также есть бонус: если вы привлечете новых пользователей таким образом, они станут вашими рефералами в @xRocket.

    🌐 <b>3. Блокчейн перевод</b>
    Если вы знаете только блокчейн адрес пользователя, вы можете отправить им криптовалюту напрямую. В этом случае применяется фиксированная блокчейн комиссия (такая же, как при выводе из @xRocket).
withdrawal-transfer-description = 🔄 Перевод другому пользователю через Telegram ID
withdrawal-multicheque-description = 🎫 Создать чек
withdrawal-external-description = 🌐 Вывод на внешний адрес кошелька
withdrawal-select-currency = 💱 Выберите валюту для вывода:
withdrawal-select-network = 🌐 Выберите сеть для { $currency }:
withdrawal-currency-selection = 💸 Выберите валюту для вывода:
withdrawal-network-selection = 🌐 Выберите сеть для { $emoji } { $name }:
withdrawal-balance-info = 
    💵 Введите сумму для вывода:

    💰 Ваш баланс { $emoji } { $name }: { $balance }
    💸 Комиссия за вывод ({ $network }): { $fee } { $name }
    📊 Максимальный вывод: { $maxWithdrawal } { $name }

withdrawal-amount-info = 
    💸 Сумма вывода: { $amount } { $emoji } { $name }
    💸 Комиссия: { $fee } { $emoji } { $name }
    💰 Общая сумма: { $totalRequired } { $emoji } { $name }

    🔗 Введите внешний адрес кошелька для { $network }:

withdrawal-confirmation = 
    ⚠️ Пожалуйста, подтвердите ваш вывод:

    💰 Сумма: { $amount } { $currency }
    💸 Комиссия: { $fee } { $currency }
    💰 Всего: { $total } { $currency }
    🌐 Сеть: { $network }
    🔗 Адрес: { $address }

    Вы хотите продолжить?

withdrawal-confirm-button = ✅ Подтвердить вывод
withdrawal-cancel-button = ❌ Отмена

withdrawal-details = 
    🌐 Детали вывода

    💰 Сумма: { $amount } { $emoji } { $name }
    💸 Комиссия: { $fee } { $emoji } { $name }
    💰 Всего: { $total } { $emoji } { $name }
    🌐 Сеть: { $network }
    🔗 Адрес: { $address }
    📊 Статус: { $statusEmoji } { $status }
    🆔 ID вывода: { $withdrawalId }
    📅 Создан: { $createdAt }

transfer-select-currency = 💱 Выберите валюту для перевода:
transfer-enter-amount = 💵 Введите сумму для перевода в { $emoji } { $name }:
transfer-enter-recipient = 
    👤 Введите Telegram ID получателя:

    Ваш Telegram ID: <code>{ $userId }</code> (нажмите, чтобы скопировать)

    Сумма: { $amount } { $emoji } { $name }
transfer-confirm-transfer = 
    📋 Подтверждение перевода

    💰 Сумма: { $amount } { $emoji } { $name }
    👤 ID получателя: { $recipientId }

    Пожалуйста, подтвердите перевод:
transfer-transfer-success = 
    ✅ Перевод успешно завершен!

    💰 Сумма: { $amount } { $emoji } { $name }
    👤 ID получателя: { $recipientId }
    🆔 ID перевода: { $transferId }

multicheque-select-currency = 💱 Выберите валюту для чека:
multicheque-enter-amount = 💵 Введите сумму для чека в { $emoji } { $name }:
multicheque-confirm-multicheque = 
    🎫 Подтверждение чека

    💰 Сумма: { $amount } { $emoji } { $name }

    Пожалуйста, подтвердите создание чека:
multicheque-multicheque-success = 
    ✅ Чек успешно создан!

    💰 Сумма: { $amount } { $emoji } { $name }
    🆔 ID чека: { $chequeId }

invoices-title = 📋 Ваши инвойсы:

invoices-no-invoices = Пока нет инвойсов
invoices-invoice-item = 
    💰 { $amount } { $emoji } { $name } - { $status }
    🆔 { $invoiceId }
    📅 { $createdAt }
invoices-invoice-detail = 
    💳 Детали инвойса

    💰 Сумма: { $amount } { $emoji } { $name }
    { $amountReceivedInfo }
    📊 Статус: { $statusEmoji } { $status }
    🆔 ID инвойса: { $invoiceId }
    📅 Создан: { $createdAt }

    { $paymentInfo }

invoices-amount-received-info = 💸 Получено: { $amountReceived } { $emoji } { $name }
📊 Комиссия: { $fee } { $emoji } { $name }

invoices-payment-info = 
    💡 Обработка платежа:
    • Нажмите 'Проверить платеж' для ручной проверки оплаты инвойса
    • Или дождитесь автоматической обработки через вебхук
    • Статус платежа обновится автоматически

invoices-pagination = Показано { $start }-{ $end } из { $total } инвойсов

invoices-pay-with-xrocket = 💳 Оплатить через xRocket Pay
invoices-pay-now = 💳 Оплатить сейчас
invoices-check-payment = 🔄 Проверить платеж
invoices-delete = 🗑️ Удалить инвойс
invoices-back-to-list = 📋 К списку инвойсов
invoices-deleted-successfully = 🗑️ Инвойс успешно удалён!
error-invoice-not-found = Инвойс не найден
pagination-previous = ⬅️ Предыдущая
pagination-next = Следующая ➡️

withdrawals-select-type = 📋 Выберите тип истории выводов:
withdrawals-transfers-title = 🔄 Ваши переводы:

withdrawals-cheques-title = 🎫 Ваши чеки:

withdrawals-external-title = 🌐 Ваши внешние выводы:

withdrawals-no-transfers = Пока нет переводов
withdrawals-no-cheques = Пока нет чеков
withdrawals-no-external = Пока нет внешних выводов
withdrawals-transfer-item = 
    💰 { $amount } { $emoji } { $name } → { $recipientId }
    🆔 { $transferId }
    📅 { $createdAt }
withdrawals-cheque-item = 
    💰 { $amount } { $emoji } { $name }
    🆔 { $chequeId }
    📅 { $createdAt }
withdrawals-external-item = 
    💰 { $amount } { $emoji } { $name } → { $address }
    🆔 { $withdrawalId }
    📅 { $createdAt }

errors-invalid-amount = Неверная сумма. Пожалуйста, попробуйте снова.
errors-invalid-currency = Выбрана неверная валюта
errors-invalid-telegram-id = Неверный Telegram ID. Пожалуйста, введите корректный номер.
errors-invalid-address = Неверный формат адреса. Пожалуйста, проверьте адрес и попробуйте снова.
errors-insufficient-balance = ❌ Недостаточно средств. У вас { $available } { $name }, но вы пытаетесь использовать { $required } { $name }.
errors-session-missing = Данные сессии отсутствуют. Пожалуйста, начните заново.
errors-no-currency-selected = Валюта не выбрана. Пожалуйста, начните заново.
errors-invalid-context = Неверный контекст для { $action }
errors-service-unavailable = Сервис временно недоступен. Пожалуйста, попробуйте позже.
errors-invalid-request = Неверный запрос. Пожалуйста, проверьте ввод и попробуйте снова.
errors-authentication-failed = Ошибка аутентификации. Пожалуйста, попробуйте позже.
errors-access-denied = Доступ запрещен. Пожалуйста, попробуйте позже.
errors-server-error = Ошибка сервера. Пожалуйста, попробуйте позже.
errors-too-many-requests = Слишком много запросов. Пожалуйста, подождите и попробуйте снова.
errors-network-error = Ошибка сети. Пожалуйста, проверьте соединение и попробуйте снова.
errors-database-error = Ошибка базы данных. Пожалуйста, попробуйте позже.
errors-session-expired = Сессия истекла. Пожалуйста, начните заново.
errors-unexpected-error = Произошла неожиданная ошибка. Пожалуйста, попробуйте снова.

buttons-confirm = ✅ Подтвердить
buttons-cancel = ❌ Отмена
buttons-back = ⬅️ Назад
buttons-next = ➡️ Далее
buttons-check-payment = 💳 Проверить платеж
buttons-pay-invoice = 💳 Оплатить инвойс
buttons-main-menu = 🏠 Главное меню
buttons-balance = 💰 Баланс
buttons-deposit = 💳 Пополнить
buttons-withdraw = 💸 Вывести
buttons-transfer = 🔄 Перевод
buttons-multicheque = 🎫 Чек
buttons-invoices = 📋 Мои инвойсы
buttons-withdrawals = 📊 Мои выводы
buttons-transfers = 🔄 Мои переводы
buttons-cheques = 🎫 Мои чеки
buttons-external = 🌐 Мои блокчейн выводы
buttons-confirm-transfer = ✅ Подтвердить перевод
buttons-confirm-withdrawal = ✅ Подтвердить
buttons-confirm-multicheque = ✅ Подтвердить чек
buttons-blockchain-transfer = 🌐 Блокчейн перевод

status-pending = ⏳ В ожидании
status-paid = ✅ Оплачен
status-completed = ✅ Завершен
status-failed = ❌ Ошибка
status-created = ⏳ Создан

# Cheque-related keys
cheques-open-cheque = 🎫 Открыть чек
cheques-back-to-list = 📋 К списку чеков
cheques-title = 🎫 Мои чеки
cheques-select-to-view = Выберите чек для просмотра деталей:
cheques-no-cheques = Чеки не найдены.
cheques-details-title = 🎫 Детали чека
cheques-amount = 💰 Сумма:
cheques-users = 👥 Пользователи:
cheques-status = 📊 Статус:
cheques-cheque-id = 🆔 ID чека:
cheques-created = 📅 Создан:

# Withdrawal-related keys
withdrawals-back-to-list = ⬅️ К списку выводов
withdrawals-blockchain-title = 🌐 Мои блокчейн выводы
withdrawals-select-to-view = Выберите вывод для просмотра деталей:
withdrawals-no-withdrawals = Выводы не найдены.
withdrawals-details-title = 🌐 Детали вывода
withdrawals-amount = 💰 Сумма:
withdrawals-fee = 💸 Комиссия:
withdrawals-total = 💰 Всего:
withdrawals-network = 🌐 Сеть:
withdrawals-address = 🔗 Адрес:
withdrawals-status = 📊 Статус:
withdrawals-withdrawal-id = 🆔 ID вывода:
withdrawals-created = 📅 Создан:
withdrawals-tx-hash = 🔗 Хеш транзакции:
withdrawals-error = ❌ Ошибка:
withdrawals-comment = 💬 Комментарий:
withdrawals-check-status = 🔄 Проверить статус
withdrawals-view-transaction = 🔗 Посмотреть транзакцию
withdrawals-back-to-withdrawals = 📊 К списку выводов

# Common words
total = всего 