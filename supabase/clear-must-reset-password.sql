-- Clear "must reset password" for users so they are not stuck on the set-password page.
-- Run in Supabase SQL Editor (Dashboard → SQL Editor). After running, affected users should sign out and sign in again to get a fresh session.
--
-- Option A: Clear for ONE user (replace the UUID with the user's id from Auth → Users)
-- update auth.users
-- set raw_app_meta_data = raw_app_meta_data - 'must_reset_password'
-- where id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
--
-- Option B: Clear for ALL users
update auth.users
set raw_app_meta_data = raw_app_meta_data - 'must_reset_password'
where raw_app_meta_data ? 'must_reset_password';
