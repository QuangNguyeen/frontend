import { useEffect, useRef, useState } from 'react';
import { GoogleLogin, type GoogleLoginProps } from '@react-oauth/google';
import { cn } from '@/lib/utils';

type ResponsiveGoogleLoginProps = Omit<GoogleLoginProps, 'width'> & {
  maxWidth?: number;
  minWidth?: number;
  className?: string;
};

export function ResponsiveGoogleLogin({
  maxWidth = 360,
  minWidth = 180,
  className,
  ...props
}: ResponsiveGoogleLoginProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(maxWidth);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const syncWidth = () => {
      const nextWidth = Math.floor(
        Math.min(maxWidth, Math.max(minWidth, root.clientWidth)),
      );
      setWidth((current) => (current === nextWidth ? current : nextWidth));
    };

    syncWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', syncWidth);
      return () => window.removeEventListener('resize', syncWidth);
    }

    const observer = new ResizeObserver(syncWidth);
    observer.observe(root);
    return () => observer.disconnect();
  }, [maxWidth, minWidth]);

  return (
    <div ref={rootRef} className={cn('flex w-full justify-center', className)}>
      <GoogleLogin {...props} width={width} />
    </div>
  );
}
