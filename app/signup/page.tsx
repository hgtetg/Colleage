import AuthPage from '@/components/auth-page';

export const metadata = {
  title: 'Create account · Campus Hub',
  description: 'Create your Campus Hub account and join your verified course.',
};

export default function SignUpPage() {
  return <AuthPage mode="signup" />;
}
