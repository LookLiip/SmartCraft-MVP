import Link from 'next/link';
import { ReactNode } from 'react';

interface NavLinkProps {
  href?: string;
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function NavLink({ href, icon, label, active, onClick }: NavLinkProps) {
  const content = (
    <>
      {icon}
      <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
    </>
  );

  const baseClasses = `flex flex-col items-center justify-center space-y-1 transition-colors ${
    active ? 'text-blue-600' : 'text-slate-500 hover:text-blue-600'
  }`;

  if (onClick) {
    return (
      <button onClick={onClick} className={baseClasses}>
        {content}
      </button>
    );
  }

  return (
    <Link href={href || '#'} className={baseClasses}>
      {content}
    </Link>
  );
}
