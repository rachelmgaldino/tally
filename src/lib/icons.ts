import {
  Baby, Banknote, Bike, Book, Briefcase, Building2, Bus, CalendarCheck, Car, Cat, ChartColumn,
  Coffee, Coins, CreditCard, Cross, Dog, DollarSign, Droplet, Dumbbell, Ellipsis, FileText, Film,
  Fuel, Gamepad2, Gift, GraduationCap, Hammer, Heart, House, Landmark, Leaf, List, Music,
  PawPrint, Percent, PiggyBank, Pill, Pizza, Plane, Receipt, Scissors, Shield, Shirt, ShoppingBag,
  ShoppingCart, Smartphone, Smile, Sparkles, Star, Stethoscope, Sun, Train, TrendingUp, Trophy,
  Tv, Umbrella, User, Users, Utensils, Wallet, Wifi, Wine, Wrench, Zap,
  type LucideIcon,
} from 'lucide-react'
import { t } from './i18n'

/** Icons a category can use, by the key stored in the database. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  utensils: Utensils, 'calendar-check': CalendarCheck, wine: Wine, home: House,
  'shopping-bag': ShoppingBag, user: User, 'file-text': FileText, 'graduation-cap': GraduationCap,
  users: Users, percent: Percent, 'bar-chart': ChartColumn, smile: Smile,
  'shopping-cart': ShoppingCart, list: List, paw: PawPrint, gift: Gift, shirt: Shirt,
  health: Cross, briefcase: Briefcase, bus: Bus, plane: Plane, dollar: DollarSign,
  'trending-up': TrendingUp, more: Ellipsis, star: Star, car: Car, fuel: Fuel, baby: Baby,
  dumbbell: Dumbbell, music: Music, game: Gamepad2, book: Book, coffee: Coffee, pizza: Pizza,
  film: Film, wifi: Wifi, phone: Smartphone, zap: Zap, droplet: Droplet, stethoscope: Stethoscope,
  pill: Pill, scissors: Scissors, hammer: Hammer, wrench: Wrench, trophy: Trophy, heart: Heart,
  sparkles: Sparkles, tv: Tv, bike: Bike, train: Train, receipt: Receipt, card: CreditCard,
  building: Building2, banknote: Banknote, coins: Coins, shield: Shield, umbrella: Umbrella,
  dog: Dog, cat: Cat, leaf: Leaf, sun: Sun, wallet: Wallet, piggy: PiggyBank,
}

export function categoryIcon(key: string): LucideIcon {
  return CATEGORY_ICONS[key] ?? Ellipsis
}

/** Generic account icons ("Ícones personalizados"). */
export const ACCOUNT_ICONS: Record<string, { label: string; icon: LucideIcon }> = {
  bank: { get label() { return t().settings.iconLabels.bank }, icon: Landmark },
  wallet: { get label() { return t().settings.iconLabels.wallet }, icon: Wallet },
  piggy: { get label() { return t().settings.iconLabels.piggy }, icon: PiggyBank },
}

export const PALETTE = [
  '#f3f4f1', '#d4d4d4', '#ffe000', '#ff1a1a', '#0a6cff', '#00e05a',
  '#ffd6a8', '#ffb86b', '#ff9f2e', '#e67a00', '#ff9fae', '#ff6b81',
  '#ff3b4f', '#d0021b', '#ff8a7a', '#ff7a66', '#ff5a3c', '#f03c1f',
  '#ffa65c', '#e8913f', '#c0763a', '#8b5a2b', '#b8e986', '#7ed321',
  '#5aa800', '#417505', '#9cf5e4', '#50e3c2', '#14d1a0', '#00a885',
  '#a8a8a8', '#777777', '#b8781f', '#f5a623', '#ffbe76', '#b8360f',
  '#ff8a65', '#ffab91', '#8e2c3a', '#ff6b6b', '#ff9a9a', '#c2407a',
  '#e8559b', '#f08cb8', '#4b1fbf', '#7451c9', '#b9a8e8', '#3f51b5',
  '#4a90e2', '#6f9fe0', '#2ec4a0', '#145c4a', '#5fd068', '#3b8a4a',
]
