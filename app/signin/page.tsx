import AuthPage from '@/components/auth-page';

export const metadata = {
  title: 'Sign in · Campus Hub',
  description: 'Sign in to your secure Campus Hub course workspace.',
};

export default function SignInPage() {
  return <AuthPage mode="signin" />;
}
