/**
 * Canonical icon module.
 *
 * The ONLY file allowed to import from `lucide-react`. All other code imports
 * from `@/lib/icons`. Mapping back to legacy react-icons is documented in
 * `docs/conversion-plan/design-system.md` §9.2.
 */
export {
  // View kinds
  BarChart3 as IconViewDashboard,
  Bold as IconBold,
  // Status / interaction
  Check as IconCheck,
  Circle as IconCircle,
  CircleArrowDown as IconArrowDown,
  CircleArrowRight as IconArrowRight,
  CirclePlus as IconCirclePlus,
  Columns3 as IconViewKanban,
  FilePlus as IconFileAdd,
  Home as IconHome,
  LogIn as IconLogIn,
  Maximize2 as IconExpand,
  Menu as IconMenu,
  MessageCircle as IconComment,
  MessageSquarePlus as IconCommentAdd,
  // Menus / overflow
  MoreHorizontal as IconMore,
  Pin as IconPin,
  // Common actions
  Plus as IconPlus,
  Search as IconSearch,
  Square as IconSquare,
  Star as IconStar,
  Trash2 as IconDelete,
  User as IconViewPerson,
  X as IconClose,
  XCircle as IconCloseCircle,
  // Workspace / brand
  Zap as IconLightning,
} from "lucide-react";
