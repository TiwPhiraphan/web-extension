export type Language = 'ts' | 'js';
export type ProjectType = 'full' | 'content-only';
export type BrowserKey = 'chrome' | 'firefox' | 'safari';
export type ManifestVersion = 2 | 3;

export type FeatureKey =
  | 'background'
  | 'content'
  | 'popup'
  | 'options'
  | 'sidepanel'
  | 'dnr'
  | 'devtools'
  | 'newtab';

export type ExtraKey =
  | 'contextmenu'
  | 'commands'
  | 'omnibox'
  | 'storage';

export type ContentScriptRunAt =
  | 'document_start'
  | 'document_end'
  | 'document_idle';

export type ContentScriptWorld = 'ISOLATED' | 'MAIN';

export type IfExistsAction = 'cancel' | 'overwrite' | 'merge';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export interface ContentScriptOptions {
  matches: string[];
  runAt: ContentScriptRunAt;
  world: ContentScriptWorld;
  css: boolean;
}

export interface Context {
  projectName: string;
  targetDir: string;
  ifExists: IfExistsAction;
  language: Language;
  projectType: ProjectType;
  browsers: BrowserKey[];
  firefoxMv?: ManifestVersion;
  safariMv?: ManifestVersion;
  features: FeatureKey[];
  contentScript?: ContentScriptOptions;
  extras: ExtraKey[];
  pm: PackageManager;
  install: boolean;
  git: boolean;
  isInteractive?: boolean;
}

