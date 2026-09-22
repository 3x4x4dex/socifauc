const TOKEN = 'SFC';
const ENERGY_POINT_COST = 3;
const supabaseClient = window.supabase && window.SOCFAUC_SUPABASE_URL && window.SOCFAUC_SUPABASE_ANON_KEY
  ? window.supabase.createClient(window.SOCFAUC_SUPABASE_URL, window.SOCFAUC_SUPABASE_ANON_KEY)
  : null;
const storedCapacity = Number(localStorage.getItem('socifaucEnergyCapacity') || 100);
const state = { balance: 38.42, daily: 2.84, energy: Math.min(Number(localStorage.getItem('socifaucEnergy') || 100), storedCapacity), energyCapacity: Math.min(1000, Math.max(100, storedCapacity)) };
let energyUpdatedAt = Number(localStorage.getItem('socifaucEnergyUpdatedAt') || Date.now());
const toast = document.getElementById('toast');
const sidebarBalance = document.getElementById('sidebarBalance');
const dailyEarn = document.getElementById('dailyEarn');
const profileModal = document.getElementById('profileModal');
const profilePhoto = document.getElementById('profilePhoto');
const profilePage = document.getElementById('profilePage');
const walletPage = document.getElementById('walletPage');
const explorePage = document.getElementById('explorePage');
const tipModal = document.getElementById('tipModal');
const storyModal = document.getElementById('storyModal');
const storyFile = document.getElementById('storyFile');
const storyUploadPreview = document.getElementById('storyUploadPreview');
const withdrawModal = document.getElementById('withdrawModal');
const energyModal = document.getElementById('energyModal');
let pendingStoryImage = '';
const communitySearch = document.getElementById('communitySearch');
const searchShell = communitySearch.closest('.search');
const searchResult = document.getElementById('searchResult');
const clearSearch = document.getElementById('clearSearch');
const contentWrap = document.querySelector('.content-wrap');
let toastTimer;

async function persistWallet() {
  if (!supabaseClient || !currentUser) return;
  const { error } = await supabaseClient.from('wallets').upsert({
    user_id: currentUser.id,
    sfc_balance: state.balance,
    energy: state.energy,
    energy_capacity: state.energyCapacity,
    energy_updated_at: new Date(energyUpdatedAt).toISOString(),
    updated_at: new Date().toISOString()
  });
  if (error) console.error('Supabase wallet:', error);
}

async function loadUserData(user) {
  if (!supabaseClient || !user) return;
  let [{ data: profile }, { data: wallet }] = await Promise.all([
    supabaseClient.from('profiles').select('display_name,username,bio,age,avatar_url,followers_count,following_count,likes_received').eq('id', user.id).maybeSingle(),
    supabaseClient.from('wallets').select('sfc_balance,energy,energy_capacity,energy_updated_at').eq('user_id', user.id).maybeSingle()
  ]);
  const fallbackName = user.user_metadata?.display_name || user.email.split('@')[0];
  const fallbackUsername = user.user_metadata?.username || user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24) || 'usuario';
  if (!profile) {
    const result = await supabaseClient.from('profiles').upsert({ id: user.id, username: fallbackUsername, display_name: fallbackName }, { onConflict: 'id' }).select('display_name,username,bio,age,avatar_url,followers_count,following_count,likes_received').single();
    if (result.error) console.error('Supabase profile create:', result.error);
    profile = result.data;
  }
  if (!wallet) {
    const result = await supabaseClient.from('wallets').upsert({ user_id: user.id, sfc_balance: 0, energy: 100, energy_capacity: 100 }, { onConflict: 'user_id' }).select('sfc_balance,energy,energy_capacity,energy_updated_at').single();
    if (result.error) console.error('Supabase wallet create:', result.error);
    wallet = result.data;
  }
  if (profile) {
    currentProfile = profile;
    document.querySelector('.profile-mini strong').textContent = profile.display_name;
    document.querySelector('.profile-mini small').textContent = `@${profile.username}`;
    document.getElementById('profileName').value = profile.display_name || '';
    document.getElementById('profileHandle').value = profile.username || '';
    document.getElementById('profileAge').value = profile.age || '';
    profileBio.value = profile.bio || '';
    bioCount.textContent = `${profileBio.value.length}/160`;
  }
  if (wallet) {
    state.balance = Number(wallet.sfc_balance);
    state.energy = Number(wallet.energy);
    state.energyCapacity = Number(wallet.energy_capacity);
    energyUpdatedAt = new Date(wallet.energy_updated_at).getTime();
    updateBalanceDisplay();
    updateEnergyDisplay();
  }
}

function applyTokenLabel() {
  const scopes = document.querySelectorAll('.balance-card, #feedPosts, .earn-card, .leaderboard, .missions, #walletPage, #profilePage, #toast');
  scopes.forEach((scope) => {
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach((node) => { node.nodeValue = node.nodeValue.replaceAll('SOCFAUC', TOKEN); });
  });
}

applyTokenLabel();
document.querySelector('.profile-dialog-head small').textContent = 'IDENTIDADE socifauc';

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

const authModal = document.getElementById('authModal');
const authDialog = authModal.querySelector('.auth-dialog');
const authForm = document.getElementById('authForm');
const authAction = document.getElementById('authAction');
let authMode = 'login';
let currentUser = null;
let currentProfile = null;

function openAuth(mode = 'login') {
  authMode = mode;
  authDialog.classList.toggle('signup', mode === 'signup');
  document.getElementById('authEyebrow').textContent = mode === 'signup' ? 'COMECE NO SOCIFAUC' : 'ENTRE NA COMUNIDADE';
  document.getElementById('authTitle').textContent = mode === 'signup' ? 'Crie sua conta' : 'Bem-vindo de volta';
  document.getElementById('authDescription').textContent = mode === 'signup' ? 'Cadastre-se para publicar, ganhar SFC e acompanhar sua carteira.' : 'Entre para publicar, ganhar SFC e acompanhar sua carteira.';
  document.getElementById('authSubmit').innerHTML = `${mode === 'signup' ? 'Criar conta' : 'Entrar'} <span>↗</span>`;
  document.getElementById('authSwitch').innerHTML = mode === 'signup' ? 'Já tem uma conta? <button type="button">Entrar</button>' : 'Ainda não tem conta? <button type="button">Criar conta</button>';
  document.getElementById('authSwitch').querySelector('button').addEventListener('click', () => openAuth(mode === 'login' ? 'signup' : 'login'));
  document.getElementById('authError').textContent = '';
  document.getElementById('resendConfirmation').classList.remove('visible');
  authModal.classList.add('open');
  authModal.setAttribute('aria-hidden', 'false');
  document.getElementById('authEmail').focus();
}

function closeAuth() {
  authModal.classList.remove('open');
  authModal.setAttribute('aria-hidden', 'true');
  authForm.reset();
}

function authErrorMessage(error) {
  if (error.message.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (error.message.toLowerCase().includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (error.message.toLowerCase().includes('rate limit') || error.status === 429) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  if (error.message.toLowerCase().includes('failed to fetch')) return 'Não foi possível conectar ao Supabase. Verifique a URL e a anon key.';
  if (error.message.includes('already registered')) return 'Este e-mail já possui uma conta.';
  if (error.message.includes('Password should be')) return 'A senha precisa ter pelo menos 6 caracteres.';
  return 'Não foi possível concluir. Confira os dados e tente novamente.';
}

async function syncAuthSession(session) {
  currentUser = session?.user || null;
  authAction.textContent = currentUser ? 'Sair' : 'Entrar';
  authAction.classList.toggle('logged-in', Boolean(currentUser));
  if (currentUser) {
    const displayName = currentUser.user_metadata?.display_name || currentUser.email.split('@')[0];
    document.querySelector('.profile-mini strong').textContent = displayName;
    document.querySelector('.profile-mini small').textContent = `@${currentUser.user_metadata?.username || currentUser.email.split('@')[0]}`;
    await loadUserData(currentUser);
  }
}

authAction.addEventListener('click', async () => {
  if (!supabaseClient) { showToast('Configure o Supabase para entrar'); return; }
  if (currentUser) {
    await supabaseClient.auth.signOut();
    showToast('Sessão encerrada');
    return;
  }
  openAuth();
});
document.getElementById('closeAuth').addEventListener('click', closeAuth);
authModal.addEventListener('click', (event) => { if (event.target === authModal) closeAuth(); });
document.getElementById('authReset').addEventListener('click', async () => {
  const email = document.getElementById('authEmail').value.trim();
  if (!email) { document.getElementById('authError').textContent = 'Informe seu e-mail para receber o link.'; return; }
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email);
  if (error) { document.getElementById('authError').textContent = authErrorMessage(error); return; }
  closeAuth();
  showToast('Link de recuperação enviado para seu e-mail');
});
document.getElementById('resendConfirmation').addEventListener('click', async () => {
  const email = document.getElementById('authEmail').value.trim();
  const errorBox = document.getElementById('authError');
  const { error } = await supabaseClient.auth.resend({ type: 'signup', email });
  if (error) { errorBox.textContent = authErrorMessage(error); return; }
  document.getElementById('resendConfirmation').classList.remove('visible');
  errorBox.textContent = 'Novo e-mail de confirmação enviado.';
});
authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!supabaseClient) return;
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const displayName = document.getElementById('authName').value.trim() || email.split('@')[0];
  const errorBox = document.getElementById('authError');
  errorBox.textContent = '';
  const result = authMode === 'signup'
    ? await supabaseClient.auth.signUp({ email, password, options: { data: { display_name: displayName, username: displayName.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24) || 'usuario' } } })
    : await supabaseClient.auth.signInWithPassword({ email, password });
  if (result.error) {
    console.error('Supabase auth:', result.error);
    errorBox.textContent = authErrorMessage(result.error);
    document.getElementById('resendConfirmation').classList.toggle('visible', result.error.message.toLowerCase().includes('email not confirmed'));
    return;
  }
  if (authMode === 'signup' && !result.data.session) {
    errorBox.textContent = 'Conta criada. Confirme o link enviado para seu e-mail antes de entrar.';
    document.getElementById('resendConfirmation').classList.add('visible');
    return;
  }
  if (authMode === 'signup' && result.data.user) {
    const username = result.data.user.user_metadata?.username || email.split('@')[0];
    await supabaseClient.from('profiles').upsert({ id: result.data.user.id, username, display_name: displayName });
    await supabaseClient.from('wallets').upsert({ user_id: result.data.user.id, sfc_balance: 0, energy: 100, energy_capacity: 100 });
  }
  closeAuth();
  showToast(authMode === 'signup' ? 'Conta criada com sucesso' : 'Login realizado com sucesso');
});

if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange((_event, session) => syncAuthSession(session));
  supabaseClient.auth.getSession().then(({ data }) => syncAuthSession(data.session));
}

function escapeHtml(value) {
  return value.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]));
}

function runCommunitySearch() {
  const term = communitySearch.value.trim().toLowerCase();
  const posts = [...document.querySelectorAll('#feedPosts > .post')];
  let matches = 0;
  posts.forEach((post) => {
    const matchesTerm = !term || post.textContent.toLowerCase().includes(term);
    post.classList.toggle('search-hidden', !matchesTerm);
    if (matchesTerm) matches += 1;
  });
  searchShell.classList.toggle('has-query', Boolean(term));
  if (!term) {
    searchResult.classList.remove('visible');
    return;
  }
  searchResult.classList.add('visible');
  searchResult.innerHTML = matches ? `<strong>${matches}</strong> ${matches === 1 ? 'post encontrado' : 'posts encontrados'} para “${escapeHtml(term)}”` : '<span class="search-empty">Nenhum post encontrado. Tente outro termo.</span>';
}

communitySearch.addEventListener('input', runCommunitySearch);
clearSearch.addEventListener('click', () => { communitySearch.value = ''; runCommunitySearch(); communitySearch.focus(); });
communitySearch.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { communitySearch.value = ''; runCommunitySearch(); }
});

function openStoryModal() {
  storyModal.classList.add('open');
  storyModal.setAttribute('aria-hidden', 'false');
  document.getElementById('storyText').focus();
}

function closeStoryModal() {
  storyModal.classList.remove('open');
  storyModal.setAttribute('aria-hidden', 'true');
}

document.getElementById('createStoryButton').addEventListener('click', openStoryModal);
document.getElementById('closeStory').addEventListener('click', closeStoryModal);
storyModal.addEventListener('click', (event) => { if (event.target === storyModal) closeStoryModal(); });

storyFile.addEventListener('change', () => {
  const [file] = storyFile.files;
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    showToast('A foto do story precisa ter até 5 MB');
    storyFile.value = '';
    return;
  }
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    pendingStoryImage = reader.result;
    storyUploadPreview.textContent = '';
    storyUploadPreview.style.backgroundImage = `url(${pendingStoryImage})`;
    storyUploadPreview.classList.add('has-image');
  });
  reader.readAsDataURL(file);
});

document.getElementById('publishStory').addEventListener('click', () => {
  const text = document.getElementById('storyText').value.trim();
  if (!text && !pendingStoryImage) {
    showToast('Adicione um texto ou uma foto ao story');
    return;
  }
  const story = document.createElement('button');
  story.className = 'story user-story';
  story.type = 'button';
  story.innerHTML = `<div class="story-ring ring-lime"><div class="avatar avatar-lime"${pendingStoryImage ? ` style="background-image:url(${pendingStoryImage});background-size:cover;background-position:center;color:transparent"` : ''}>${pendingStoryImage ? '' : 'MC'}</div></div><small>${escapeHtml(text || 'Seu story')}</small>`;
  document.querySelector('.stories').prepend(story);
  document.getElementById('storyText').value = '';
  storyFile.value = '';
  pendingStoryImage = '';
  storyUploadPreview.style.backgroundImage = '';
  storyUploadPreview.textContent = 'Adicione uma foto opcional';
  storyUploadPreview.classList.remove('has-image');
  closeStoryModal();
  showToast('+0.100000 SFC por publicar um story');
  updateBalance(0.1);
});

function updateBalance(amount) {
  state.balance += amount;
  state.daily += amount;
  updateBalanceDisplay();
  persistWallet();
}

function updateBalanceDisplay() {
  sidebarBalance.innerHTML = `${state.balance.toFixed(6)} <small>${TOKEN}</small>`;
  dailyEarn.innerHTML = `${state.daily.toFixed(6)} <span>${TOKEN}</span>`;
  document.getElementById('walletPageBalance').textContent = state.balance.toFixed(6);
  document.getElementById('tipBalance').textContent = `${state.balance.toFixed(6)} ${TOKEN}`;
}

function updateEnergyDisplay() {
  const elapsed = Math.max(0, Date.now() - energyUpdatedAt);
  state.energy = Math.min(state.energy + (elapsed / 86400000) * state.energyCapacity, state.energyCapacity);
  energyUpdatedAt = Date.now();
  const energy = Math.max(0, Math.min(state.energyCapacity, state.energy));
  const currentLabel = `${Math.floor(energy)}% / ${state.energyCapacity}%`;
  document.getElementById('sidebarEnergy').textContent = currentLabel;
  document.getElementById('sidebarEnergyBar').style.width = `${(energy / state.energyCapacity) * 100}%`;
  document.getElementById('composerEnergy').textContent = currentLabel;
  localStorage.setItem('socifaucEnergy', String(energy));
  localStorage.setItem('socifaucEnergyCapacity', String(state.energyCapacity));
  localStorage.setItem('socifaucEnergyUpdatedAt', String(energyUpdatedAt));
  persistWallet();
}

updateEnergyDisplay();

function openEnergyModal() {
  document.getElementById('energyAmount').value = '10';
  document.getElementById('energyAmount').max = String(Math.floor(state.energyCapacity - state.energy));
  const capacityLabel = document.getElementById('energyCapacityLabel');
  if (capacityLabel) capacityLabel.textContent = `${state.energyCapacity}%`;
  document.getElementById('energyCost').textContent = `${(10 * ENERGY_POINT_COST).toFixed(6)} ${TOKEN}`;
  document.getElementById('energyBalance').textContent = `${state.balance.toFixed(6)} ${TOKEN}`;
  document.getElementById('energyWarning').textContent = '';
  energyModal.classList.add('open');
  energyModal.setAttribute('aria-hidden', 'false');
  document.getElementById('energyAmount').focus();
}

function closeEnergyModal() {
  energyModal.classList.remove('open');
  energyModal.setAttribute('aria-hidden', 'true');
}

document.getElementById('openEnergy').addEventListener('click', openEnergyModal);
document.getElementById('closeEnergy').addEventListener('click', closeEnergyModal);
energyModal.addEventListener('click', (event) => { if (event.target === energyModal) closeEnergyModal(); });
document.getElementById('energyAmount').addEventListener('input', (event) => {
  const amount = Math.max(0, Number(event.target.value) || 0);
  document.getElementById('energyCost').textContent = `${(amount * ENERGY_POINT_COST).toFixed(6)} ${TOKEN}`;
});
document.getElementById('confirmEnergy').addEventListener('click', () => {
  const amount = Number(document.getElementById('energyAmount').value);
  const warning = document.getElementById('energyWarning');
  const cost = amount * ENERGY_POINT_COST;
  if (!Number.isInteger(amount) || amount < 1) { warning.textContent = 'Escolha uma quantidade inteira de pontos de energia.'; return; }
  if (amount > Math.floor(state.energyCapacity - state.energy)) { warning.textContent = `Você só pode comprar mais ${Math.floor(state.energyCapacity - state.energy)} pontos agora.`; return; }
  if (cost > state.balance) { warning.textContent = `Saldo insuficiente. Esta compra custa ${cost.toFixed(6)} SFC.`; return; }
  state.balance -= cost;
  state.energy += amount;
  sidebarBalance.innerHTML = `${state.balance.toFixed(6)} <small>${TOKEN}</small>`;
  dailyEarn.innerHTML = `${state.daily.toFixed(6)} <span>${TOKEN}</span>`;
  document.getElementById('walletPageBalance').textContent = state.balance.toFixed(6);
  document.getElementById('energyBalance').textContent = `${state.balance.toFixed(6)} ${TOKEN}`;
  updateEnergyDisplay();
  closeEnergyModal();
  showToast(`${amount}% de energia adicionada por ${cost.toFixed(6)} SFC`);
});

function getPostId(post) {
  if (!post.dataset.postId) post.dataset.postId = `post-${[...document.querySelectorAll('#feedPosts > .post')].indexOf(post) + 1}`;
  return post.dataset.postId;
}

function hasActionReward(post, action) {
  const rewards = JSON.parse(localStorage.getItem('socifaucActionRewards') || '{}');
  return rewards[`${getPostId(post)}:${action}`] === true;
}

function claimActionReward(post, action) {
  const rewards = JSON.parse(localStorage.getItem('socifaucActionRewards') || '{}');
  const key = `${getPostId(post)}:${action}`;
  if (rewards[key]) return false;
  rewards[key] = true;
  localStorage.setItem('socifaucActionRewards', JSON.stringify(rewards));
  return true;
}

function rewardPostOwner(post) {
  const reward = 0.01;
  const owner = post.querySelector('.post-author strong')?.textContent.replace('✓', '').trim() || 'criador';
  const earned = post.querySelector('.post-stats .earned');
  const currentText = earned?.textContent.match(/[\d.]+/)?.[0] || '0';
  const currentValue = Number(currentText);
  if (earned) earned.textContent = `+${(currentValue + reward).toFixed(6)} ${TOKEN}`;
  if (owner === 'Marina Costa') updateBalance(reward);
  return owner;
}

document.querySelectorAll('.like-btn').forEach((button) => {
  button.addEventListener('click', () => {
    const count = button.querySelector('span');
    const countText = count.textContent.trim().toLowerCase();
    const currentValue = countText.endsWith('k') ? parseFloat(countText) * 1000 : Number(countText);
    const value = currentValue + (button.classList.contains('liked') ? -1 : 1);
    count.textContent = value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value;
    button.classList.toggle('liked');
    if (button.classList.contains('liked')) {
      const post = button.closest('.post');
      if (claimActionReward(post, 'like')) {
        const owner = rewardPostOwner(post);
        showToast(`${owner} recebeu +0.010000 SFC pela curtida`);
      } else showToast('Curtida restaurada; bônus já recebido neste post');
    }
  });
});

document.querySelectorAll('.tip-btn').forEach((button) => {
  button.addEventListener('click', () => {
    openTipModal(button);
  });
});

function openTipModal(button) {
  tipModal.dataset.postId = button.closest('.post').dataset.postId || '';
  tipModal.dataset.recipientId = button.closest('.post').dataset.authorId || '';
  const author = button.closest('.post').querySelector('.post-author strong');
  document.getElementById('tipRecipient').textContent = author ? author.textContent.replace('✓', '').trim() : 'criador';
  document.getElementById('tipAmount').value = '0.020000';
  document.getElementById('tipMessage').value = '';
  document.getElementById('tipBalance').textContent = `${state.balance.toFixed(6)} ${TOKEN}`;
  tipModal.classList.add('open');
  tipModal.style.opacity = '1';
  tipModal.style.visibility = 'visible';
  tipModal.setAttribute('aria-hidden', 'false');
  document.getElementById('tipAmount').focus();
}

function closeTipModal() {
  tipModal.classList.remove('open');
  tipModal.style.opacity = '0';
  tipModal.style.visibility = 'hidden';
  tipModal.setAttribute('aria-hidden', 'true');
}

document.getElementById('closeTip').addEventListener('click', closeTipModal);
tipModal.addEventListener('click', (event) => { if (event.target === tipModal) closeTipModal(); });
document.getElementById('confirmTip').addEventListener('click', async () => {
  const amount = Number(document.getElementById('tipAmount').value);
  if (!Number.isFinite(amount) || amount < 0.000001) { showToast('Informe um valor válido'); return; }
  if (amount > state.balance) { showToast('Saldo insuficiente para enviar esta gorjeta'); return; }
  state.balance -= amount;
  state.daily -= amount;
  sidebarBalance.innerHTML = `${state.balance.toFixed(6)} <small>${TOKEN}</small>`;
  dailyEarn.innerHTML = `${state.daily.toFixed(6)} <span>${TOKEN}</span>`;
  document.getElementById('walletPageBalance').textContent = state.balance.toFixed(6);
  const recipient = document.getElementById('tipRecipient').textContent;
  const message = document.getElementById('tipMessage').value.trim();
  if (supabaseClient && currentUser && tipModal.dataset.recipientId && tipModal.dataset.postId.length > 30) {
    const { error } = await supabaseClient.from('tips').insert({ post_id: tipModal.dataset.postId, sender_id: currentUser.id, recipient_id: tipModal.dataset.recipientId, amount_sfc: amount, message });
    if (error) { showToast('Não foi possível salvar a gorjeta'); return; }
  }
  await persistWallet();
  closeTipModal();
  showToast(`-${amount.toFixed(6)} SFC enviados para ${recipient}${message ? ' · mensagem enviada' : ''}`);
});

function getPostCommentCount(button) {
  const stats = button.closest('.post').querySelector('.post-stats');
  return [...stats.querySelectorAll('span')].find((item) => item.textContent.includes('coment'));
}

function addCommentBox(button) {
  const post = button.closest('.post');
  const existing = post.querySelector('.inline-comment-box');
  if (existing) { existing.remove(); return; }
  const box = document.createElement('form');
  box.className = 'inline-comment-box';
  box.innerHTML = '<input type="text" maxlength="240" placeholder="Escreva um comentário..." aria-label="Comentário" /><button type="submit">Enviar</button>';
  post.querySelector('.post-actions').after(box);
  box.querySelector('input').focus();
  box.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = box.querySelector('input');
    if (!input.value.trim()) return;
    if (supabaseClient && currentUser && post.dataset.postId.length > 30) {
      const { error } = await supabaseClient.from('comments').insert({ post_id: post.dataset.postId, author_id: currentUser.id, body: input.value.trim() });
      if (error) { showToast('Não foi possível salvar o comentário'); return; }
    }
    const count = getPostCommentCount(button);
    const current = Number((count.textContent.match(/[\d.]+/) || ['0'])[0].replace('.', '')) + 1;
    count.textContent = `${current} comentários`;
    const earnedCommentReward = claimActionReward(post, 'comment');
    if (earnedCommentReward) updateBalance(0.005);
    box.remove();
    showToast(earnedCommentReward ? '+0.005000 SFC por comentar' : 'Comentário publicado; bônus já recebido neste post');
  });
}

document.getElementById('feedPosts').addEventListener('click', (event) => {
  const button = event.target.closest('.post-actions button');
  if (!button) return;
  const buttons = [...button.parentElement.children];
  const action = buttons.indexOf(button) === 1 ? 'comment' : buttons.indexOf(button) === 2 ? 'repost' : '';
  if (buttons.indexOf(button) === 0 && supabaseClient && currentUser) {
    const post = button.closest('.post');
    const postId = post.dataset.postId;
    const liked = button.classList.toggle('liked');
    const count = button.querySelector('span');
    const rawCount = Number(count.textContent.toLowerCase().replace('k', ''));
    const value = rawCount + (liked ? 1 : -1);
    count.textContent = value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(Math.max(0, value));
    const request = liked
      ? supabaseClient.from('post_likes').insert({ post_id: postId, user_id: currentUser.id })
      : supabaseClient.from('post_likes').delete().eq('post_id', postId).eq('user_id', currentUser.id);
    request.then(({ error }) => { if (error) showToast('Não foi possível salvar a curtida'); });
    return;
  }
  if (action === 'comment') addCommentBox(button);
  if (action === 'repost') {
    const reposted = button.classList.toggle('reposted');
    button.querySelector('span').textContent = reposted ? 'Repostado' : 'Repostar';
    const repostRequest = reposted && supabaseClient && currentUser
      ? supabaseClient.from('reposts').insert({ post_id: button.closest('.post').dataset.postId, user_id: currentUser.id })
      : !reposted && supabaseClient && currentUser
        ? supabaseClient.from('reposts').delete().eq('post_id', button.closest('.post').dataset.postId).eq('user_id', currentUser.id)
        : null;
    if (repostRequest) repostRequest.then(({ error }) => { if (error) showToast('Não foi possível salvar o repost'); });
    if (reposted && claimActionReward(button.closest('.post'), 'repost')) {
      updateBalance(0.015);
      showToast('+0.015000 SFC por repostar');
    } else if (reposted) showToast('Repost restaurado; bônus já recebido neste post');
  }
});

document.querySelectorAll('.nav-item, [data-section="wallet"], [data-section="feed"]').forEach((button) => {
  button.addEventListener('click', () => {
    const section = button.dataset.section;
    if (section === 'wallet') showWalletPage();
    if (section === 'explore') showExplorePage();
    if (section === 'missions') showToast('Você tem 3 missões esperando hoje');
    if (section === 'notifications') showToast('Você tem 3 novas notificações');
    if (section === 'messages') showToast('Você tem 12 mensagens novas');
    if (section === 'profile') showProfilePage();
    if (section === 'feed') showFeed();
    document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
    if (button.classList.contains('nav-item')) button.classList.add('active');
  });
});

function showProfilePage() {
  contentWrap.style.display = 'none';
  walletPage.classList.remove('visible');
  explorePage.classList.remove('visible');
  profilePage.classList.add('visible');
  syncProfilePage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showWalletPage() {
  contentWrap.style.display = 'none';
  profilePage.classList.remove('visible');
  explorePage.classList.remove('visible');
  walletPage.classList.add('visible');
  document.getElementById('walletPageBalance').textContent = state.balance.toFixed(6);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openWithdrawModal() {
  document.getElementById('withdrawBalance').textContent = `${state.balance.toFixed(6)} ${TOKEN}`;
  document.getElementById('withdrawAmount').value = '';
  document.getElementById('withdrawWallet').value = '';
  document.getElementById('withdrawWarning').textContent = '';
  withdrawModal.classList.add('open');
  withdrawModal.setAttribute('aria-hidden', 'false');
  document.getElementById('withdrawWallet').focus();
}

function closeWithdrawModal() {
  withdrawModal.classList.remove('open');
  withdrawModal.setAttribute('aria-hidden', 'true');
}

document.getElementById('openWithdraw').addEventListener('click', openWithdrawModal);
document.getElementById('closeWithdraw').addEventListener('click', closeWithdrawModal);
withdrawModal.addEventListener('click', (event) => { if (event.target === withdrawModal) closeWithdrawModal(); });
document.getElementById('confirmWithdraw').addEventListener('click', () => {
  const wallet = document.getElementById('withdrawWallet').value.trim();
  const amount = Number(document.getElementById('withdrawAmount').value);
  const warning = document.getElementById('withdrawWarning');
  const isPolygonWallet = /^0x[a-fA-F0-9]{40}$/.test(wallet);
  if (!isPolygonWallet) { warning.textContent = 'Informe um endereço Polygon válido começando com 0x.'; return; }
  if (!Number.isFinite(amount) || amount < 0.000001) { warning.textContent = 'Informe uma quantidade maior que 0.000000 SFC.'; return; }
  if (amount > state.balance) { warning.textContent = 'A quantidade solicitada é maior que seu saldo disponível.'; return; }
  state.balance -= amount;
  state.daily = Math.max(0, state.daily - amount);
  sidebarBalance.innerHTML = `${state.balance.toFixed(6)} <small>${TOKEN}</small>`;
  dailyEarn.innerHTML = `${state.daily.toFixed(6)} <span>${TOKEN}</span>`;
  document.getElementById('walletPageBalance').textContent = state.balance.toFixed(6);
  persistWallet();
  closeWithdrawModal();
  showToast(`Saque de ${amount.toFixed(6)} SFC enviado para ${wallet.slice(0, 6)}...${wallet.slice(-4)}`);
});

function showExplorePage() {
  contentWrap.style.display = 'none';
  profilePage.classList.remove('visible');
  walletPage.classList.remove('visible');
  explorePage.classList.add('visible');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showFeed() {
  profilePage.classList.remove('visible');
  walletPage.classList.remove('visible');
  explorePage.classList.remove('visible');
  contentWrap.style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('.explore-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    const selected = tab.dataset.exploreTab;
    document.querySelectorAll('.explore-tab').forEach((item) => item.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.explore-card').forEach((card) => {
      const category = card.classList.contains('explore-followers') ? 'followers' : card.classList.contains('explore-likes') ? 'likes' : card.classList.contains('explore-trending') ? 'trending' : 'sfc';
      card.classList.toggle('explore-hidden', selected !== 'all' && selected !== category);
    });
    document.querySelector('.explore-discovery').classList.toggle('explore-hidden', selected !== 'all');
    showToast(`${tab.textContent} selecionado`);
  });
});
document.getElementById('exploreRefresh').addEventListener('click', () => showToast('Explorar atualizado agora'));

async function syncProfilePage() {
  const saved = JSON.parse(localStorage.getItem('socfaucProfile') || 'null');
  const name = currentProfile?.display_name || saved?.name || currentUser?.user_metadata?.display_name || currentUser?.email?.split('@')[0] || 'Usuário socifauc';
  const handle = currentProfile?.username || saved?.handle || currentUser?.user_metadata?.username || currentUser?.email?.split('@')[0] || 'usuario';
  const bio = currentProfile?.bio ?? saved?.bio ?? '';
  document.getElementById('profilePageTitle').textContent = name;
  document.getElementById('profilePageHandle').textContent = `@${handle}`;
  document.getElementById('profilePageBio').textContent = bio;
  const profile = currentProfile || {};
  document.getElementById('profilePostsCount').textContent = '0';
  document.getElementById('profileFollowers').textContent = profile.followers_count || '0';
  document.getElementById('profileFollowing').textContent = profile.following_count || '0';
  document.getElementById('profileLikes').textContent = profile.likes_received || '0';
  const recentPosts = document.querySelector('.profile-recent');
  if (supabaseClient && currentUser) {
    const { data: posts, error } = await supabaseClient.from('posts').select('body,likes_count,comments_count,reward_sfc,created_at').eq('author_id', currentUser.id).order('created_at', { ascending: false }).limit(10);
    if (!error && posts) {
      const totalLikes = posts.reduce((sum, post) => sum + Number(post.likes_count || 0), 0);
      const totalRewards = posts.reduce((sum, post) => sum + Number(post.reward_sfc || 0), 0);
      document.getElementById('profilePostsCount').textContent = String(posts.length);
      document.getElementById('profileLikes').textContent = totalLikes.toLocaleString('pt-BR');
      recentPosts.innerHTML = `<div class="profile-section-title"><h2>Posts recentes</h2><span>${posts.length ? 'dados do Supabase' : 'ainda sem posts'}</span></div>${posts.length ? posts.map((post) => `<article class="profile-post"><div class="profile-post-meta"><span>${new Date(post.created_at).toLocaleDateString('pt-BR')}</span><b>+${Number(post.reward_sfc || 0).toFixed(6)} ${TOKEN}</b></div><p>${escapeHtml(post.body || '')}</p><div><span>♡ ${Number(post.likes_count || 0)} curtidas</span><span>◌ ${Number(post.comments_count || 0)} comentários</span></div></article>`).join('') : '<div class="feed-empty">Você ainda não publicou.</div>'}`;
      const postEarnings = document.querySelector('.profile-insight-card .lime-text');
      if (postEarnings) postEarnings.textContent = totalRewards.toFixed(6);
    }
  }
  const savedPhoto = localStorage.getItem('socfaucProfilePhoto');
  const pagePhoto = document.getElementById('profilePagePhoto');
  if (savedPhoto) { pagePhoto.textContent = ''; pagePhoto.style.backgroundImage = `url(${savedPhoto})`; }
}

document.getElementById('profileBack').addEventListener('click', showFeed);
document.getElementById('walletBack').addEventListener('click', showFeed);
document.getElementById('editProfilePage').addEventListener('click', () => {
  openProfile();
});

function openProfile() {
  profileModal.classList.add('open');
  profileModal.style.opacity = '1';
  profileModal.style.visibility = 'visible';
  profileModal.setAttribute('aria-hidden', 'false');
  document.getElementById('profileName').focus();
}

function closeProfile() {
  profileModal.classList.remove('open');
  profileModal.style.opacity = '0';
  profileModal.style.visibility = 'hidden';
  profileModal.setAttribute('aria-hidden', 'true');
}

document.getElementById('closeProfile').addEventListener('click', closeProfile);
profileModal.addEventListener('click', (event) => {
  if (event.target === profileModal) closeProfile();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && profileModal.classList.contains('open')) closeProfile();
});

const profileUpload = document.getElementById('profileUpload');
profileUpload.addEventListener('change', () => {
  const [file] = profileUpload.files;
  if (!file || file.size > 5 * 1024 * 1024) {
    showToast('Escolha uma imagem de até 5 MB');
    return;
  }
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    profilePhoto.textContent = '';
    profilePhoto.style.backgroundImage = `url(${reader.result})`;
    localStorage.setItem('socfaucProfilePhoto', reader.result);
  });
  reader.readAsDataURL(file);
});

const profileBio = document.getElementById('profileBio');
const bioCount = document.getElementById('bioCount');
profileBio.addEventListener('input', () => { bioCount.textContent = `${profileBio.value.length}/160`; });
document.getElementById('profileForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const name = document.getElementById('profileName').value.trim() || 'Marina Costa';
  const handle = document.getElementById('profileHandle').value.trim() || 'marinac';
  const bio = profileBio.value.trim();
  currentProfile = { ...(currentProfile || {}), display_name: name, username: handle, bio, age: Number(document.getElementById('profileAge').value) || null };
  localStorage.setItem('socfaucProfile', JSON.stringify({ name, handle, age: document.getElementById('profileAge').value, bio }));
  if (supabaseClient && currentUser) {
    supabaseClient.from('profiles').upsert({ id: currentUser.id, username: handle, display_name: name, age: Number(document.getElementById('profileAge').value) || null, bio }).then(({ error }) => {
      if (error) showToast('Perfil salvo localmente; banco recusou a atualização');
    });
  }
  document.querySelector('.profile-mini strong').textContent = name;
  document.querySelector('.profile-mini small').textContent = `@${handle}`;
  syncProfilePage();
  closeProfile();
  showToast('Perfil atualizado com sucesso');
});

const savedPhoto = localStorage.getItem('socfaucProfilePhoto');
if (savedPhoto) { profilePhoto.textContent = ''; profilePhoto.style.backgroundImage = `url(${savedPhoto})`; }
const savedProfile = JSON.parse(localStorage.getItem('socfaucProfile') || 'null');
if (savedProfile) {
  document.getElementById('profileName').value = savedProfile.name || '';
  document.getElementById('profileHandle').value = savedProfile.handle || '';
  document.getElementById('profileAge').value = savedProfile.age || '';
  profileBio.value = savedProfile.bio || '';
  bioCount.textContent = `${profileBio.value.length}/160`;
  document.querySelector('.profile-mini strong').textContent = savedProfile.name || 'Marina Costa';
  document.querySelector('.profile-mini small').textContent = `@${savedProfile.handle || 'marinac'}`;
}

const postInput = document.getElementById('postInput');
const charCount = document.getElementById('charCount');
const photoInput = document.getElementById('photoInput');
const composerAttachment = document.getElementById('composerAttachment');
const pollBuilder = document.getElementById('pollBuilder');
let pendingImage = '';
postInput.addEventListener('input', () => {
  if (postInput.value.length > 280) postInput.value = postInput.value.slice(0, 280);
  charCount.textContent = `${postInput.value.length}/280`;
});

document.getElementById('photoTool').addEventListener('click', () => photoInput.click());
photoInput.addEventListener('change', () => {
  const [file] = photoInput.files;
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    showToast('A foto precisa ter até 5 MB');
    photoInput.value = '';
    return;
  }
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    pendingImage = reader.result;
    composerAttachment.innerHTML = `<img src="${pendingImage}" alt="Preview da foto selecionada" /><button class="remove-attachment" type="button" aria-label="Remover foto">×</button>`;
    composerAttachment.classList.add('visible');
    composerAttachment.querySelector('.remove-attachment').addEventListener('click', clearPendingImage);
  });
  reader.readAsDataURL(file);
});

function clearPendingImage() {
  pendingImage = '';
  photoInput.value = '';
  composerAttachment.innerHTML = '';
  composerAttachment.classList.remove('visible');
}

document.getElementById('pollTool').addEventListener('click', () => {
  pollBuilder.classList.toggle('visible');
  if (pollBuilder.classList.contains('visible')) document.getElementById('pollQuestion').focus();
});
document.getElementById('closePollBuilder').addEventListener('click', () => pollBuilder.classList.remove('visible'));
document.getElementById('addPollOption').addEventListener('click', () => {
  const options = document.querySelectorAll('.poll-input');
  if (options.length >= 4) {
    showToast('Uma enquete pode ter até 4 opções');
    return;
  }
  const option = document.createElement('input');
  option.className = 'poll-input';
  option.type = 'text';
  option.maxLength = 70;
  option.placeholder = `Opção ${options.length + 1}`;
  document.getElementById('pollOptions').appendChild(option);
});

document.getElementById('publishBtn').addEventListener('click', async () => {
  if (supabaseClient && !currentUser) {
    openAuth();
    showToast('Entre para publicar na comunidade');
    return;
  }
  const text = postInput.value.trim();
  const pollQuestion = document.getElementById('pollQuestion').value.trim();
  const pollOptions = [...document.querySelectorAll('.poll-input')].map((input) => input.value.trim()).filter(Boolean);
  if (!text && !pendingImage && !pollQuestion) {
    showToast('Adicione texto, foto ou enquete antes de publicar');
    postInput.focus();
    return;
  }
  if (state.energy < 1) {
    showToast('Energia insuficiente. Converta SFC em energia para publicar.');
    return;
  }
  state.energy -= 1;
  updateEnergyDisplay();
  let remotePost = null;
  if (supabaseClient && currentUser) {
    const result = await supabaseClient.from('posts').insert({
      author_id: currentUser.id,
      body: text,
      image_url: pendingImage || null,
      poll_question: pollQuestion || null,
      poll_options: pollQuestion ? pollOptions : null,
      reward_sfc: 0.5
    }).select('id').single();
    if (result.error) {
      state.energy += 1;
      updateEnergyDisplay();
      showToast('Não foi possível salvar o post no Supabase');
      console.error('Supabase post:', result.error);
      return;
    }
    remotePost = result.data;
  }
  const safeText = text.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]));
  const imageMarkup = pendingImage ? `<div class="post-uploaded-image"><img src="${pendingImage}" alt="Imagem publicada por Marina Costa" /></div>` : '';
  const pollMarkup = pollQuestion ? `<div class="poll"><div class="poll-head"><span>${pollQuestion.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]))}</span><strong>0 votos</strong></div>${pollOptions.map((option) => `<button class="poll-option" type="button"><span>${option.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]))}</span><b>0%</b><i style="width:0%"></i></button>`).join('')}</div>` : '';
  const article = document.createElement('article');
  article.className = 'post panel';
  article.dataset.postId = remotePost?.id || `post-${Date.now()}`;
  article.innerHTML = `<div class="post-author"><div class="avatar avatar-lime">MC</div><div><strong>Marina Costa <i>✓</i></strong><small>@marinac · agora</small></div><button class="post-more">•••</button></div>${safeText ? `<p>${safeText}</p>` : ''}${imageMarkup}${pollMarkup}<div class="post-stats"><span>0 comentários</span><span>agora</span><span class="earned">+0.500000 ${TOKEN}</span></div><div class="post-actions"><button class="like-btn">♡ <span>0</span></button><button>◌ <span>0</span></button><button>↗ <span>Repostar</span></button><button class="tip-btn">S <span>Dar gorjeta</span></button></div>`;
  document.getElementById('feedPosts').prepend(article);
  runCommunitySearch();
  updateBalance(0.5);
  postInput.value = '';
  charCount.textContent = '0/280';
  clearPendingImage();
  pollBuilder.classList.remove('visible');
  document.getElementById('pollQuestion').value = '';
  document.getElementById('pollOptions').innerHTML = '<input class="poll-input" type="text" maxlength="70" placeholder="Opção 1" /><input class="poll-input" type="text" maxlength="70" placeholder="Opção 2" />';
  showToast(`+0.500000 ${TOKEN} por criar um post original`);
  article.querySelector('.like-btn').addEventListener('click', (event) => {
    const button = event.currentTarget;
    const count = button.querySelector('span');
    count.textContent = button.classList.contains('liked') ? '0' : '1';
    button.classList.toggle('liked');
    if (button.classList.contains('liked')) {
      const post = button.closest('.post');
      if (claimActionReward(post, 'like')) showToast(`${rewardPostOwner(post)} recebeu +0.010000 ${TOKEN} pela curtida`);
      else showToast('Curtida restaurada; bônus já recebido neste post');
    }
  });
  article.querySelector('.tip-btn').addEventListener('click', () => openTipModal(article.querySelector('.tip-btn')));
});

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((item) => item.classList.remove('active'));
    tab.classList.add('active');
    showToast(`${tab.textContent} selecionado`);
  });
});

function renderRemotePost(post) {
  const author = post.profiles || {};
  const name = escapeHtml(author.display_name || author.username || 'Usuário socifauc');
  const handle = escapeHtml(author.username || 'usuario');
  const body = escapeHtml(post.body || '');
  const image = post.image_url ? `<div class="post-uploaded-image"><img src="${escapeHtml(post.image_url)}" alt="Imagem publicada por ${name}" /></div>` : '';
  const poll = post.poll_question ? `<div class="poll"><div class="poll-head"><span>${escapeHtml(post.poll_question)}</span><strong>0 votos</strong></div>${(post.poll_options || []).map((option) => `<button class="poll-option" type="button"><span>${escapeHtml(option)}</span><b>0%</b><i style="width:0%"></i></button>`).join('')}</div>` : '';
  const article = document.createElement('article');
  article.className = 'post panel';
  article.dataset.postId = post.id;
  article.dataset.authorId = post.author_id;
  article.innerHTML = `<div class="post-author"><div class="avatar avatar-lime">${name.slice(0, 2).toUpperCase()}</div><div><strong>${name} <i>✓</i></strong><small>@${handle} · ${new Date(post.created_at).toLocaleDateString('pt-BR')}</small></div><button class="post-more">•••</button></div>${body ? `<p>${body}</p>` : ''}${image}${poll}<div class="post-stats"><span>${post.comments_count || 0} comentários</span><span>${post.likes_count || 0} curtidas</span><span class="earned">+${Number(post.reward_sfc || 0).toFixed(6)} ${TOKEN}</span></div><div class="post-actions"><button class="like-btn">♡ <span>${post.likes_count || 0}</span></button><button class="comment-btn">◌ <span>${post.comments_count || 0}</span></button><button>↗ <span>Repostar</span></button><button class="tip-btn">S <span>Dar gorjeta</span></button></div>`;
  return article;
}

async function loadRemoteFeed() {
  if (!supabaseClient) return;
  const feed = document.getElementById('feedPosts');
  feed.innerHTML = '<div class="feed-empty">Carregando publicações da comunidade...</div>';
  const { data, error } = await supabaseClient.from('posts').select('id,author_id,body,image_url,poll_question,poll_options,likes_count,comments_count,reposts_count,reward_sfc,created_at,profiles!posts_author_id_fkey(display_name,username,avatar_url)').order('created_at', { ascending: false });
  if (error) {
    feed.innerHTML = `<div class="feed-empty">Não foi possível carregar o feed. Execute o arquivo supabase-schema.sql no Supabase.</div>`;
    console.error('Supabase posts:', error);
    return;
  }
  feed.innerHTML = '';
  if (!data.length) {
    feed.innerHTML = '<div class="feed-empty">Ainda não há publicações. Seja o primeiro a postar.</div>';
    return;
  }
  data.forEach((post) => feed.appendChild(renderRemotePost(post)));
  runCommunitySearch();
}

loadRemoteFeed();
