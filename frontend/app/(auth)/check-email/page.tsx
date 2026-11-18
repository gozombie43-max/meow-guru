import { redirect } from 'next/navigation';

// Email links were replaced by in-page 6-digit codes on the sign-in screen.
export default function Page() {
  redirect('/login');
}
