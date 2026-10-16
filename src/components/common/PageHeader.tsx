import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@heroui/react';

interface PageHeaderProps {
  icon: LucideIcon;
  /** Gradient of the icon tile */
  iconClassName?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Goes under the title on phones, at its right from `sm` */
  action?: ReactNode;
}

/** The banner at the top of Settings, Dogs, Members, Admin and the health passport. */
export function PageHeader({ icon: Icon, iconClassName = 'from-indigo-500 to-purple-600', title, subtitle, action }: PageHeaderProps) {
  return (
    <Card className="shadow-xl">
      <Card.Content className="flex-row flex-wrap items-center gap-3 sm:gap-4 p-3.5 sm:p-5">
        <div className={`p-2.5 sm:p-3 bg-gradient-to-br ${iconClassName} rounded-xl shadow-md shrink-0`}>
          <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base sm:text-lg font-black leading-tight sm:leading-snug break-words">{title}</h2>
          {subtitle && <p className="text-xs text-muted mt-0.5 sm:mt-1 leading-normal break-words">{subtitle}</p>}
        </div>
        {action && <div className="w-full sm:w-auto shrink-0">{action}</div>}
      </Card.Content>
    </Card>
  );
}
