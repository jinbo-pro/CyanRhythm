import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/songs' },
  {
    path: '/songs',
    name: 'songs',
    component: () => import('../views/SongsView.vue'),
    meta: { title: '歌曲' },
  },
  {
    path: '/albums',
    name: 'albums',
    component: () => import('../views/AlbumsView.vue'),
    meta: { title: '专辑' },
  },
  {
    path: '/albums/:name',
    name: 'album-detail',
    component: () => import('../views/SongsView.vue'),
    meta: { title: '专辑' },
  },
  {
    path: '/artists',
    name: 'artists',
    component: () => import('../views/ArtistsView.vue'),
    meta: { title: '歌手' },
  },
  {
    path: '/folders',
    name: 'folders',
    component: () => import('../views/FoldersView.vue'),
    meta: { title: '文件夹' },
  },
  {
    path: '/folder',
    name: 'folder-detail',
    component: () => import('../views/SongsView.vue'),
    meta: { title: '文件夹' },
  },
  {
    path: '/artists/:name',
    name: 'artist-detail',
    component: () => import('../views/SongsView.vue'),
    meta: { title: '歌手' },
  },
  {
    path: '/playlist/:id',
    name: 'playlist',
    component: () => import('../views/PlaylistView.vue'),
    meta: { title: '播放列表' },
  },
  {
    path: '/stats',
    name: 'stats',
    component: () => import('../views/StatsView.vue'),
    meta: { title: '播放统计' },
  },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})
