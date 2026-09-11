// One-shot verification of the openArtifactFile logic branches.
(async () => {
  let openCalls = [];
  let copied = null;
  const fakeCtx = {
    sidebarRight: {
      openResource: (url) => { openCalls.push(url); },
    },
  };
  const fakeNav = {
    clipboard: {
      writeText: (t) => { copied = t; return Promise.resolve(); },
    },
  };

  function artifactToken(task, name) {
    if (task.archived && task.month) return '@.trellis/tasks/archive/' + task.month + '/' + task.slug + '/' + name;
    return '@.trellis/tasks/' + task.slug + '/' + name;
  }
  function artifactResourceUrl(sessionId, token) {
    const path = (token || '').replace(/^@/, '');
    const encodeSegment = (s) => encodeURIComponent(s).replace(/%3A/gi, ':');
    const encodedPath = path.replace(/\\/g, '/').split('/').map(encodeSegment).join('/');
    return 'dsh-resource://file/session/' + encodeSegment(sessionId) + '/' + encodedPath;
  }
  function openArtifactFile(ctx, sessionId, token) {
    try {
      const sidebar = ctx && ctx.sidebarRight;
      if (sidebar && typeof sidebar.openResource === 'function') {
        sidebar.openResource(artifactResourceUrl(sessionId, token));
        return true;
      }
    } catch { /* fall through to clipboard copy */ }
    try {
      if (fakeNav.clipboard && fakeNav.clipboard.writeText) fakeNav.clipboard.writeText(token);
      else throw new Error('no clipboard');
    } catch { /* nothing more */ }
    return false;
  }

  // Case 1: active task, native open
  const t1 = artifactToken({ slug: 'feat-08-15-billing' }, 'prd.md');
  const r1 = openArtifactFile(fakeCtx, 's1', t1);
  console.log('case1 native open:', r1, openCalls[0]);

  // Case 2: archived task, native open
  const t2 = artifactToken({ archived: true, month: '2025-08', slug: 'feat-08-15-billing' }, 'design.md');
  const r2 = openArtifactFile(fakeCtx, 's1', t2);
  console.log('case2 archive open:', r2, openCalls[1]);

  // Case 3: no sidebar -> clipboard fallback, input box untouched
  const r3 = openArtifactFile(null, 's1', t1);
  console.log('case3 fallback copy:', r3, 'copied===token:', copied === t1);
})();
