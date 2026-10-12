// Настройки подключения. Пустые supabaseUrl / supabaseAnonKey = демо-режим (данные в localStorage браузера).
// anon-ключ Supabase публичный по замыслу: данные защищает RLS, а не секретность ключа.
window.Tolyan = window.Tolyan || {};
window.Tolyan.config = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  // Только для демо-режима. Это НЕ защита: пароль виден любому, кто откроет файл.
  demoPassword: 'tolyan'
};
