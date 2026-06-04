type Props = {
  onGoogle: () => void;
  onApple: () => void;
  disabled?: boolean;
};

function AppleIcon() {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

export function SocialSignInButtons({ onGoogle, onApple, disabled }: Props) {
  return (
    <>
      <button
        className="btn-oauth btn-google"
        type="button"
        onClick={onGoogle}
        disabled={disabled}
      >
        <span aria-hidden>G</span>
        Continue with Google
      </button>
      <button
        className="btn-oauth btn-apple"
        type="button"
        onClick={onApple}
        disabled={disabled}
      >
        <AppleIcon />
        Continue with Apple
      </button>
    </>
  );
}
