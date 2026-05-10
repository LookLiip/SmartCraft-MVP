import Link from 'next/link';
import { ReactNode } from 'react';

interface NavLinkProps {
  href: string;
  icon: ReactNode;
  label: string;
}

export function NavLink({ href, icon, label }: NavLinkProps) {
  return (
    <Link 
      href={href} 
      className="flex flex-col items-center justify-center space-y-1 text-slate-500 hover:text-blue-600 transition-colors"
    >
      {icon}
      <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
    </Link>
  );
}
