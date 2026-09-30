import { useState } from 'react';
import logo from './assets/logo.png';
import {
  Home as HomeIcon, Cpu, Wrench, CalendarClock, PieChart, ShoppingBag, PackageSearch,
  AlertTriangle, Bell, UserCog, Menu, X, LogOut, Loader2, Plus,
} from 'lucide-react';
import { useSessionState } from './lib/useSessionState';
import { useAuth } from './lib/useAuth';
import { Login, SetPassword, NoAccess } from './components/Auth';
import { NotificationBell, useNotifications } from './components/Notifications';
import NotificationsScreen from './components/Notifications';
import Home from './components/Home';
import Equipments from './components/Equipments';
import EquipmentDetail from './components/EquipmentDetail';
import Maintenances from './components/Maintenances';
import MaintenanceForm from './components/MaintenanceForm';
import Plans from './components/Plans';
import Costs from './components/Costs';
import Purchases from './components/Purchases';
import StockSuggestion from './components/StockSuggestion';
import Errors from './components/Errors';
import Account from './components/Account';

export type ViewId =
  | 'home' | 'equipments' | 'equipment' | 'maintenances' | 'plans' | 'costs'
  | 'purchases' | 'stock' | 'errors' | 'notifications' | 'account';

export type Nav = { view: ViewId; id?: string };
export type Go = (view: ViewId, id?: string) => void;

type NavItem = { id: ViewId; label: string; icon: typeof HomeIcon };

const navGroups: { label: string; items: NavItem[] }[] = [
  { label: '', items: [{ id: 'home', label: 'Início', icon: HomeIcon }] },
  {
    label: 'Equipamentos',
    items: [
      { id: 'equipments', label: 'Meus equipamentos', icon: Cpu },
      { id: 'maintenances', label: 'Manutenções', icon: Wrench },
      { id: 'plans', label: 'Preventivas', icon: CalendarClock },
      { id: 'errors', label: 'Erros', icon: AlertTriangle },
    ],
  },
  {
    label: 'Custos e peças',
    items: [
      { id: 'costs', label: 'Custos', icon: PieChart },
      { id: 'purchases', label: 'Compras Laser Tools', icon: ShoppingBag },
      { id: 'stock', label: 'Estoque sugerido', icon: PackageSearch },
    ],
  },
];

const TITLES: Record<ViewId, string> = {
  home: 'Início', equipments: 'Meus equipamentos', equipment: 'Equipamento', maintenances: 'Manutenções',
  plans: 'Manutenções preventivas', costs: 'Custos', purchases: 'Compras Laser Tools',
  stock: 'Estoque sugerido', errors: 'Erros dos equipamentos', notifications: 'Notificações', account: 'Minha conta',
};

export default function App() {
  const auth = useAuth();
  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }
  if (auth.session && auth.needsPassword) {
    return <SetPassword kind={auth.needsPassword} onDone={auth.clearNeedsPassword} />;
  }
  if (!auth.session) return <Login />;
  if (!auth.me) return <NoAccess email={auth.session.user.email ?? ''} onSignOut={auth.signOut} />;
  return <Portal customerId={auth.me.customer_id} customerName={auth.me.customer_name} userName={auth.me.full_name || auth.me.email} signOut={auth.signOut} refreshMe={auth.refreshMe} />;
}

function Portal({
  customerId, customerName, userName, signOut, refreshMe,
}: {
  customerId: string;
  customerName: string;
  userName: string;
  signOut: () => void;
  refreshMe: () => void;
}) {
  const [nav, setNav] = useSessionState<Nav>('portal:nav', { view: 'home' });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickMaintenance, setQuickMaintenance] = useState(false);
  // Bumped after a quick-add so the current screen reloads its data.
  const [refreshKey, setRefreshKey] = useState(0);
  const notifications = useNotifications(customerId);

  const go: Go = (view, id) => {
    setNav({ view, id });
    setMobileOpen(false);
    document.querySelector('main')?.scrollTo({ top: 0 });
  };

  const render = () => {
    switch (nav.view) {
      case 'home': return <Home go={go} customerName={customerName} />;
      case 'equipments': return <Equipments go={go} />;
      case 'equipment': return nav.id ? <EquipmentDetail id={nav.id} go={go} /> : <Equipments go={go} />;
      case 'maintenances': return <Maintenances go={go} />;
      case 'plans': return <Plans go={go} focusId={nav.id} />;
      case 'costs': return <Costs go={go} />;
      case 'purchases': return <Purchases />;
      case 'stock': return <StockSuggestion />;
      case 'errors': return <Errors go={go} />;
      case 'notifications': return <NotificationsScreen state={notifications} go={go} />;
      case 'account': return <Account onSaved={refreshMe} />;
    }
  };

  const activeNav = nav.view === 'equipment' ? 'equipments' : nav.view;

  return (
    <div className="flex h-full bg-slate-50 text-slate-900">
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-72 lg:w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="px-5 pt-4 pb-3 border-b border-slate-200">
          <div className="flex items-center">
            <img src={logo} alt="Laser Tools" className="w-32 object-contain" />
            <button className="ml-auto lg:hidden icon-btn" onClick={() => setMobileOpen(false)}>
              <X size={18} />
            </button>
          </div>
          <div className="mt-3 text-[10px] font-bold tracking-[0.18em] uppercase text-sky-600">Portal do Cliente</div>
          <div className="text-sm font-semibold text-slate-800 truncate">{customerName}</div>
        </div>
        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.label || 'root'}>
              {group.label && (
                <div className="px-3 mb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{group.label}</div>
              )}
              <div className="space-y-1">
                {group.items.map((n) => {
                  const active = activeNav === n.id;
                  const Icon = n.icon;
                  return (
                    <button
                      key={n.id}
                      onClick={() => go(n.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Icon size={18} className={active ? 'text-white' : 'text-slate-400'} />
                      {n.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-xs font-bold text-sky-700 shrink-0">
              {userName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 text-xs font-semibold text-slate-700 truncate">{userName}</div>
            <div className="ml-auto flex items-center gap-1 shrink-0">
              <button className="icon-btn" title="Minha conta" onClick={() => go('account')}>
                <UserCog size={16} />
              </button>
              <button className="icon-btn" title="Sair" onClick={() => signOut()}>
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white/80 backdrop-blur border-b border-slate-200 flex items-center gap-3 px-4 lg:px-8 sticky top-0 z-20">
          <button className="lg:hidden icon-btn" onClick={() => setMobileOpen(true)} aria-label="Menu">
            <Menu size={20} />
          </button>
          <h1 className="text-lg font-bold text-slate-900 truncate">{TITLES[nav.view]}</h1>
          <div className="ml-auto flex items-center gap-2">
            <button className="btn-primary hidden sm:inline-flex" onClick={() => setQuickMaintenance(true)}>
              <Plus size={16} /> Registrar manutenção
            </button>
            <NotificationBell state={notifications} go={go} />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 pb-24 sm:pb-8">
          <div className="max-w-6xl mx-auto" key={refreshKey}>{render()}</div>
        </main>
      </div>

      {/* Mobile quick action */}
      <button
        className="sm:hidden fixed right-4 bottom-5 z-30 w-14 h-14 rounded-2xl bg-slate-900 text-white shadow-lg flex items-center justify-center active:scale-95 transition"
        onClick={() => setQuickMaintenance(true)}
        aria-label="Registrar manutenção"
      >
        <Plus size={24} />
      </button>

      {quickMaintenance && (
        <MaintenanceForm
          onClose={() => setQuickMaintenance(false)}
          onSaved={() => { setQuickMaintenance(false); setRefreshKey((k) => k + 1); }}
        />
      )}
    </div>
  );
}
