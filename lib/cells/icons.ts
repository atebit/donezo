/**
 * Maps every CellTypeId to a lucide-react icon component.
 *
 * Note: `formula` uses `Sigma` (not `Function`, which is not a valid lucide
 * icon name as of lucide-react ≥ 0.400).
 */

import {
  AlertCircle,
  AlignLeft,
  BarChart2,
  Calendar,
  CalendarDays,
  CheckSquare,
  Circle,
  Clock,
  DollarSign,
  Globe,
  Hash,
  Link,
  Mail,
  MapPin,
  Paperclip,
  Phone,
  Sigma,
  Star,
  Tags,
  ThumbsUp,
  Type,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";

import type { CellTypeId } from "./types";

export const CELL_TYPE_ICONS: Record<CellTypeId, ComponentType<{ className?: string }>> = {
  text: Type,
  long_text: AlignLeft,
  status: Circle,
  priority: AlertCircle,
  person: Users,
  date: Calendar,
  timeline: BarChart2,
  number: Hash,
  currency: DollarSign,
  checkbox: CheckSquare,
  file: Paperclip,
  link: Link,
  tags: Tags,
  rating: Star,
  email: Mail,
  phone: Phone,
  country: Globe,
  vote: ThumbsUp,
  week: CalendarDays,
  location: MapPin,
  updated_by: UserCheck,
  created_by: UserPlus,
  created_at_col: Clock,
  formula: Sigma,
};
