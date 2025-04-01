import { FC } from 'react';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { LayoutDashboard, BarChart3, Users, Settings } from 'lucide-react';

export const Sidebar: FC = () => {
  const [location] = useLocation();

  const navigation = [
    { name: 'Main Project', href: '/', icon: LayoutDashboard, current: location === '/' },
    { name: 'Marketing', href: '/marketing', icon: BarChart3, current: location === '/marketing' },
    { name: 'Development', href: '/development', icon: LayoutDashboard, current: location === '/development' },
  ];

  const teams = [
    { name: 'Core Team', href: '/teams/core', icon: Users, current: location === '/teams/core' },
    { name: 'Design Squad', href: '/teams/design', icon: Users, current: location === '/teams/design' },
  ];

  return (
    <div className="w-64 bg-slate-800 text-white flex flex-col shadow-lg z-10 h-screen">
      <div className="p-4 border-b border-slate-700">
        <h1 className="text-xl font-bold">TaskFlow</h1>
        <p className="text-sm text-slate-400">Collaborative Work Management</p>
      </div>
      
      <div className="p-4 flex-1 overflow-y-auto">
        <div className="mb-8">
          <h2 className="text-xs uppercase font-semibold text-slate-400 mb-2">Workspaces</h2>
          <ul>
            {navigation.map((item) => (
              <li key={item.name} className="mb-1">
                <Link href={item.href} className={cn(
                  "flex items-center p-2 rounded-md", 
                  item.current 
                    ? "bg-slate-700 text-white" 
                    : "text-slate-300 hover:bg-slate-700"
                )}>
                  <item.icon className="h-5 w-5 mr-2" />
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        
        <div className="mb-8">
          <h2 className="text-xs uppercase font-semibold text-slate-400 mb-2">Teams</h2>
          <ul>
            {teams.map((team) => (
              <li key={team.name} className="mb-1">
                <Link href={team.href} className={cn(
                  "flex items-center p-2 rounded-md", 
                  team.current 
                    ? "bg-slate-700 text-white" 
                    : "text-slate-300 hover:bg-slate-700"
                )}>
                  <team.icon className="h-5 w-5 mr-2" />
                  {team.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center">
          <img src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" 
               alt="User avatar" 
               className="w-8 h-8 rounded-full mr-2" />
          <div className="flex-1">
            <p className="text-sm font-medium">Alex Morgan</p>
            <p className="text-xs text-slate-400">alex@company.com</p>
          </div>
          <button className="text-slate-400 hover:text-white">
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
