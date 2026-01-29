export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Serve the HTML page
    if (request.method === 'GET' && url.pathname === '/') {
      return new Response(HTML_CONTENT, {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
    }

    // Serve the template download
    if (request.method === 'GET' && url.pathname === '/download-template') {
      return handleTemplateDownload();
    }

    // Handle the API proxy request for updating permissions
    if (request.method === 'POST' && url.pathname === '/api/update-permissions') {
      return handlePermissionUpdate(request);
    }

    // Handle the API proxy request for exporting permissions
    if (request.method === 'POST' && url.pathname === '/api/export-permissions') {
      return handlePermissionExport(request);
    }

    return new Response('Not Found', { status: 404 });
  }
};

function handleTemplateDownload() {
  const headers = [
    'username',
    'view_form',
    'edit_form',
    'manage_project',
    'add_submissions',
    'view_submissions',
    'edit_submissions',
    'delete_submissions',
    'validate_submissions',
    'partial_view',
    'partial_view_filter_field',
    'partial_view_filter_value',
    'partial_edit',
    'partial_edit_filter_field',
    'partial_edit_filter_value',
    'partial_delete',
    'partial_delete_filter_field',
    'partial_delete_filter_value',
    'partial_validate',
    'partial_validate_filter_field',
    'partial_validate_filter_value'
  ];

  const exampleRows = [
    ['steve_kobo', 'TRUE', 'TRUE', 'TRUE', 'TRUE', 'TRUE', 'TRUE', 'TRUE', 'TRUE', 'FALSE', '', '', 'FALSE', '', '', 'FALSE', '', '', 'FALSE', '', ''],
    ['bob_kobo', 'TRUE', 'FALSE', 'FALSE', 'TRUE', 'FALSE', 'FALSE', 'FALSE', 'FALSE', 'TRUE', 'organization', 'bar', 'FALSE', '', '', 'FALSE', '', '', 'TRUE', 'organization', 'bar'],
    ['alice_viewer', 'TRUE', 'FALSE', 'FALSE', 'FALSE', 'FALSE', 'FALSE', 'FALSE', 'FALSE', 'TRUE', '_submitted_by', 'alice_viewer', 'FALSE', '', '', 'FALSE', '', '', 'FALSE', '', '']
  ];

  const tsvContent = [
    headers.join('\t'),
    ...exampleRows.map(row => row.join('\t'))
  ].join('\n');

  return new Response(tsvContent, {
    headers: {
      'Content-Type': 'text/tab-separated-values',
      'Content-Disposition': 'attachment; filename="kobo_permissions_template.tsv"'
    }
  });
}

async function handlePermissionExport(request) {
  try {
    const { token, baseUrl, assetUid, owner } = await request.json();

    if (!token || !baseUrl || !assetUid) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const headers = {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json'
    };

    // Get existing permissions
    const permsUrl = `${baseUrl}/api/v2/assets/${assetUid}/permission-assignments/`;
    const permsRes = await fetch(permsUrl, { headers });
    
    if (!permsRes.ok) {
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch permissions',
        status: permsRes.status 
      }), {
        status: permsRes.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const permissions = await permsRes.json();
    
    // Filter out owner's permissions if owner is provided
    const filteredPermissions = owner 
      ? permissions.filter(perm => !perm.user.includes(owner))
      : permissions;
    
    // Convert permissions to TSV format
    const tsvData = convertPermissionsToTSV(filteredPermissions);
    
    return new Response(tsvData, {
      headers: {
        'Content-Type': 'text/tab-separated-values',
        'Content-Disposition': `attachment; filename="kobo_permissions_${assetUid}.tsv"`
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function convertPermissionsToTSV(permissions) {
  const headers = [
    'username',
    'view_form',
    'edit_form',
    'manage_project',
    'add_submissions',
    'view_submissions',
    'edit_submissions',
    'delete_submissions',
    'validate_submissions',
    'partial_view',
    'partial_view_filter_field',
    'partial_view_filter_value',
    'partial_edit',
    'partial_edit_filter_field',
    'partial_edit_filter_value',
    'partial_delete',
    'partial_delete_filter_field',
    'partial_delete_filter_value',
    'partial_validate',
    'partial_validate_filter_field',
    'partial_validate_filter_value'
  ];

  // Group permissions by user
  const userPerms = {};
  
  for (const perm of permissions) {
    const username = perm.user.split('/').filter(p => p).pop();
    
    if (!userPerms[username]) {
      userPerms[username] = {
        username,
        view_form: 'FALSE',
        edit_form: 'FALSE',
        manage_project: 'FALSE',
        add_submissions: 'FALSE',
        view_submissions: 'FALSE',
        edit_submissions: 'FALSE',
        delete_submissions: 'FALSE',
        validate_submissions: 'FALSE',
        partial_view: 'FALSE',
        partial_view_filter_field: '',
        partial_view_filter_value: '',
        partial_edit: 'FALSE',
        partial_edit_filter_field: '',
        partial_edit_filter_value: '',
        partial_delete: 'FALSE',
        partial_delete_filter_field: '',
        partial_delete_filter_value: '',
        partial_validate: 'FALSE',
        partial_validate_filter_field: '',
        partial_validate_filter_value: ''
      };
    }

    const permName = perm.permission.split('/').filter(p => p).pop();
    
    // Map simple permissions
    if (permName === 'view_asset') userPerms[username].view_form = 'TRUE';
    if (permName === 'change_asset') userPerms[username].edit_form = 'TRUE';
    if (permName === 'manage_asset') userPerms[username].manage_project = 'TRUE';
    if (permName === 'add_submissions') userPerms[username].add_submissions = 'TRUE';
    if (permName === 'view_submissions') userPerms[username].view_submissions = 'TRUE';
    if (permName === 'change_submissions') userPerms[username].edit_submissions = 'TRUE';
    if (permName === 'delete_submissions') userPerms[username].delete_submissions = 'TRUE';
    if (permName === 'validate_submissions') userPerms[username].validate_submissions = 'TRUE';
    
    // Handle partial permissions with multiple filters
    if (permName === 'partial_submissions' && perm.partial_permissions) {
      for (const pp of perm.partial_permissions) {
        const ppName = pp.url.split('/').filter(p => p).pop();
        
        // Collect all filter values for this permission type
        const filterValues = [];
        let filterField = '';
        
        if (pp.filters && pp.filters.length > 0) {
          // Get the filter field name from first filter
          filterField = Object.keys(pp.filters[0])[0] || '';
          
          // Collect all values (supports multiple filters)
          for (const filter of pp.filters) {
            const value = filter[filterField];
            if (value && !filterValues.includes(value)) {
              filterValues.push(value);
            }
          }
        }
        
        const filterValue = filterValues.join(',');
        
        if (ppName === 'view_submissions') {
          userPerms[username].partial_view = 'TRUE';
          userPerms[username].partial_view_filter_field = filterField;
          userPerms[username].partial_view_filter_value = filterValue;
        }
        if (ppName === 'change_submissions') {
          userPerms[username].partial_edit = 'TRUE';
          userPerms[username].partial_edit_filter_field = filterField;
          userPerms[username].partial_edit_filter_value = filterValue;
        }
        if (ppName === 'delete_submissions') {
          userPerms[username].partial_delete = 'TRUE';
          userPerms[username].partial_delete_filter_field = filterField;
          userPerms[username].partial_delete_filter_value = filterValue;
        }
        if (ppName === 'validate_submissions') {
          userPerms[username].partial_validate = 'TRUE';
          userPerms[username].partial_validate_filter_field = filterField;
          userPerms[username].partial_validate_filter_value = filterValue;
        }
      }
    }
  }

  // Convert to TSV rows
  const rows = Object.values(userPerms).map(user => 
    headers.map(h => user[h]).join('\t')
  );

  return [headers.join('\t'), ...rows].join('\n');
}

async function handlePermissionUpdate(request) {
  try {
    const { token, baseUrl, assetUid, owner, users } = await request.json();

    if (!token || !baseUrl || !assetUid || !owner || !users) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const headers = {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json'
    };

    // Get existing permissions
    const permsUrl = `${baseUrl}/api/v2/assets/${assetUid}/permission-assignments/`;
    const existingPermsRes = await fetch(permsUrl, { headers });
    
    if (!existingPermsRes.ok) {
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch existing permissions',
        status: existingPermsRes.status 
      }), {
        status: existingPermsRes.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const existingPerms = await existingPermsRes.json();
    const newUsernames = users.map(u => u.username);

    // Remove owner's permissions AND any users that are in the new data
    const cleanedPerms = existingPerms.filter(perm => {
      const username = perm.user.split('/').filter(p => p).pop();
      return !perm.user.includes(owner) && !newUsernames.includes(username);
    });

    // Build user permissions
    const userPerms = [];
    for (const user of users) {
      const perms = buildUserPermissions(user, baseUrl);
      userPerms.push(...perms);
    }

    // Combine: cleaned_perms + user_perms
    const allPerms = [...cleanedPerms, ...userPerms];
    const bulkUrl = `${baseUrl}/api/v2/assets/${assetUid}/permission-assignments/bulk/`;
    
    const updateRes = await fetch(bulkUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(allPerms)
    });

    const responseData = updateRes.ok ? await updateRes.json() : await updateRes.text();

    return new Response(JSON.stringify({
      success: updateRes.ok,
      status: updateRes.status,
      message: `Updated permissions for ${users.length} users on asset ${assetUid}`,
      data: responseData
    }), {
      status: updateRes.status,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function buildUserPermissions(user, baseUrl) {
  const permissions = [];
  const userUrl = `${baseUrl}/api/v2/users/${user.username}/`;

  // Simple permissions (TRUE/FALSE only)
  const simplePerms = [
    { field: 'view_form', perm: 'view_asset' },
    { field: 'edit_form', perm: 'change_asset' },
    { field: 'manage_project', perm: 'manage_asset' },
    { field: 'add_submissions', perm: 'add_submissions' },
    { field: 'view_submissions', perm: 'view_submissions' },
    { field: 'edit_submissions', perm: 'change_submissions' },
    { field: 'delete_submissions', perm: 'delete_submissions' },
    { field: 'validate_submissions', perm: 'validate_submissions' }
  ];

  for (const { field, perm } of simplePerms) {
    if (user[field] === 'TRUE') {
      permissions.push({
        user: userUrl,
        permission: `${baseUrl}/api/v2/permissions/${perm}/`
      });
    }
  }

  // Partial permissions
  const partialPerms = [];
  
  if (user.partial_view === 'TRUE' && user.partial_view_filter_field && user.partial_view_filter_value) {
    // Handle comma-separated values for multiple filters
    const filterValues = user.partial_view_filter_value.split(',').map(v => v.trim()).filter(v => v);
    const filters = filterValues.map(value => ({
      [user.partial_view_filter_field]: value
    }));
    
    partialPerms.push({
      perm: 'view_submissions',
      filters: filters
    });
  }

  if (user.partial_edit === 'TRUE' && user.partial_edit_filter_field && user.partial_edit_filter_value) {
    const filterValues = user.partial_edit_filter_value.split(',').map(v => v.trim()).filter(v => v);
    const filters = filterValues.map(value => ({
      [user.partial_edit_filter_field]: value
    }));
    
    partialPerms.push({
      perm: 'change_submissions',
      filters: filters
    });
  }

  if (user.partial_delete === 'TRUE' && user.partial_delete_filter_field && user.partial_delete_filter_value) {
    const filterValues = user.partial_delete_filter_value.split(',').map(v => v.trim()).filter(v => v);
    const filters = filterValues.map(value => ({
      [user.partial_delete_filter_field]: value
    }));
    
    partialPerms.push({
      perm: 'delete_submissions',
      filters: filters
    });
  }

  if (user.partial_validate === 'TRUE' && user.partial_validate_filter_field && user.partial_validate_filter_value) {
    const filterValues = user.partial_validate_filter_value.split(',').map(v => v.trim()).filter(v => v);
    const filters = filterValues.map(value => ({
      [user.partial_validate_filter_field]: value
    }));
    
    partialPerms.push({
      perm: 'validate_submissions',
      filters: filters
    });
  }

  // Add partial permissions if any exist
  if (partialPerms.length > 0) {
    permissions.push({
      user: userUrl,
      permission: `${baseUrl}/api/v2/permissions/partial_submissions/`,
      partial_permissions: partialPerms.map(pp => ({
        url: `${baseUrl}/api/v2/permissions/${pp.perm}/`,
        filters: pp.filters
      }))
    });
  }

  return permissions;
}

const HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>KoboToolbox Bulk Permission Updater</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #f4f5f7;
            color: #586069;
            min-height: 100vh;
            padding: 20px;
            position: relative;
        }
        .container {
            background: #ffffff;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            max-width: 1200px;
            width: 100%;
            margin: 0 auto;
            padding: 32px 40px;
        }
        h1 {
            color: #2c3e50;
            margin-bottom: 10px;
            font-size: 24px;
            font-weight: 500;
        }
        h2 {
            color: #2c3e50;
            margin: 30px 0 15px 0;
            font-size: 18px;
            font-weight: 500;
            border-bottom: 1px solid #e1e4e8;
            padding-bottom: 8px;
        }
        h3 {
            color: #2c3e50;
            font-size: 18px;
            font-weight: 500;
            margin-bottom: 10px;
        }
        .subtitle {
            color: #7f8c8d;
            margin-bottom: 30px;
            font-size: 14px;
        }
        .template-section, .export-section {
            background: #f8f9fa;
            border-radius: 4px;
            padding: 25px;
            margin-bottom: 30px;
            border: 1px solid #e1e4e8;
        }
        .template-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            flex-wrap: wrap;
            gap: 15px;
        }
        .download-btn, .export-btn, .submit-btn {
            background: #4A90E2;
            color: white;
            border: none;
            padding: 12px 16px;
            border-radius: 3px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        .download-btn:hover, .export-btn:hover, .submit-btn:hover {
            background: #357ABD;
        }
        .download-btn:active, .export-btn:active, .submit-btn:active {
            background: #2E6DA4;
        }
        .submit-btn {
            width: 100%;
        }
        .export-btn:disabled, .submit-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            background: #95a5a6;
        }
        .info-box {
            background: #e8f4fd;
            border-left: 4px solid #4A90E2;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
        }
        .info-box.warning {
            background: #fff3cd;
            border-left-color: #ffc107;
        }
        .info-box h3 {
            color: #2c3e50;
            margin-bottom: 10px;
            font-size: 18px;
        }
        .info-box.warning h3 {
            color: #d97706;
        }
        .info-box ul {
            margin-left: 20px;
            color: #586069;
            font-size: 14px;
        }
        .info-box li {
            margin: 5px 0;
        }
        .info-box code {
            background: #fff;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            color: #d63384;
        }
        .columns-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 10px;
            margin: 15px 0;
        }
        .column-item {
            background: white;
            padding: 10px;
            border-radius: 4px;
            border: 1px solid #d1d5da;
        }
        .column-name {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            font-weight: bold;
            color: #4A90E2;
        }
        .column-desc {
            font-size: 11px;
            color: #7f8c8d;
            margin-top: 4px;
            letter-spacing: 0.3px;
        }
        .form-group {
            margin-bottom: 20px;
        }
        .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            align-items: end;
        }
        label {
            display: block;
            margin-bottom: 8px;
            color: #2c3e50;
            font-weight: 500;
            font-size: 13px;
        }
        input[type="text"], input[type="password"], textarea {
            width: 100%;
            padding: 11px 12px;
            border: 1px solid #d1d5da;
            border-radius: 3px;
            font-size: 14px;
            transition: border-color 0.2s, box-shadow 0.2s;
            font-family: inherit;
        }
        input[type="text"]:focus, input[type="password"]:focus, textarea:focus {
            outline: none;
            border-color: #4A90E2;
            box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
        }
        textarea {
            resize: vertical;
            min-height: 200px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
        }
        .help-text {
            font-size: 12px;
            color: #7f8c8d;
            margin-top: 5px;
        }
        .example {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 11px;
            margin-top: 8px;
            overflow-x: auto;
            border: 1px solid #d1d5da;
        }
        .result {
            margin-top: 20px;
            padding: 15px;
            border-radius: 4px;
            display: none;
        }
        .result.success {
            background: #d4edda;
            border: 1px solid #c3e6cb;
            color: #155724;
        }
        .result.error {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
        }
        .result-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            user-select: none;
        }
        .result-header:hover {
            opacity: 0.8;
        }
        .toggle-details {
            font-size: 12px;
            color: #586069;
            text-decoration: underline;
        }
        .result-details {
            margin-top: 10px;
            display: none;
        }
        .result-details.visible {
            display: block;
        }
        .result pre {
            background: rgba(255,255,255,0.5);
            padding: 10px;
            border-radius: 4px;
            overflow-x: auto;
            font-size: 12px;
            margin: 0;
        }
        .loading {
            display: none;
            text-align: center;
            margin-top: 20px;
        }
        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #4A90E2;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .example-users {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 15px;
            margin: 15px 0;
        }
        .example-user {
            padding: 15px;
            border-radius: 4px;
            border: 1px solid #d1d5da;
            background: #fff;
        }
        .example-user.admin {
            border-left: 4px solid #28a745;
        }
        .example-user.partial {
            border-left: 4px solid #ffc107;
        }
        .example-user.viewer {
            border-left: 4px solid #17a2b8;
        }
        .example-user-name {
            font-weight: 500;
            margin-bottom: 5px;
            font-size: 14px;
            color: #2c3e50;
        }
        .example-user-desc {
            font-size: 12px;
            color: #586069;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔐 KoboToolbox Bulk Permission Updater</h1>
        <p class="subtitle">Update permissions for multiple users across your KoboToolbox assets</p>
        
        <div class="template-section">
            <h2 style="margin: 0 0 20px 0; border: none; padding: 0;">⚙️ Configuration</h2>
            <div class="form-group">
                <label for="globalToken">API Token *</label>
                <input type="password" id="globalToken" required placeholder="Your KoboToolbox API token">
                <div class="help-text">Find your token in KoboToolbox: Account Settings → Security</div>
            </div>

            <div class="form-group">
                <div class="form-row">
                    <div>
                        <label for="globalBaseUrl">Base URL *</label>
                        <input type="text" id="globalBaseUrl" value="https://kf.kobotoolbox.org" required>
                    </div>
                   <div>
                        <label for="globalAssetUid">Asset UID *</label>
                        <input type="text" id="globalAssetUid" required placeholder="e.g., aDfB7bVxuuUJZNuiBazM2k">
                    </div>
                </div>
            </div>
             <div class="form-group">
                <label for="globalOwner">Owner Username (Required for Update)</label>
                <input type="text" id="globalOwner" placeholder="your_username">
                <div class="help-text">Used for updates. Optional for export (if provided, excludes owner from export).</div>
            </div>
        </div>

        <div class="export-section">
            <div class="template-header">
                <div>
                    <h2 style="margin: 0; border: none; padding: 0;">📤 Export Current Permissions</h2>
                    <p style="color: #7f8c8d; font-size: 13px; margin-top: 5px;">Download existing permissions as TSV template</p>
                </div>
            </div>

            <div class="info-box warning">
                <h3>📋 How to Export</h3>
                <ul>
                    <li>Fill in the <strong>Configuration</strong> section above</li>
                    <li>Click "Export Permissions" to download current permissions</li>
                    <li>The file will be in the same format as the template</li>
                    <li><strong>Note:</strong> Multiple filter values are comma-separated (e.g., <code>val1,val2,val3</code>)</li>
                    <li>Make your changes in Excel/Google Sheets</li>
                    <li>Upload the modified file below to update permissions</li>
                </ul>
            </div>

            <form id="exportForm">
                <div class="form-group">
                    <button type="submit" class="export-btn">
                        <span>📤</span> Export Permissions
                    </button>
                </div>
            </form>

            <div class="loading" id="exportLoading">
                <div class="spinner"></div>
                <p style="margin-top: 10px; color: #7f8c8d;">Exporting...</p>
            </div>

            <div id="exportResult" class="result"></div>
        </div>

        <div class="template-section">
            <div class="template-header">
                <div>
                    <h2 style="margin: 0; border: none; padding: 0;">📋 Permission Template</h2>
                    <p style="color: #7f8c8d; font-size: 13px; margin-top: 5px;">Download the blank template to get started</p>
                </div>
                <button class="download-btn" onclick="downloadTemplate()">
                    <span>⬇</span> Download Blank Template
                </button>
            </div>

            <div class="info-box">
                <h3>📌 Template Guide</h3>
                <ul>
                    <li>Use <code>TRUE</code> or <code>FALSE</code> for all permission columns</li>
                    <li><strong>Full permissions</strong> (e.g., <code>view_submissions</code>) grant access to ALL submissions</li>
                    <li><strong>Partial permissions</strong> require both the permission flag AND filter field/value</li>
                    <li>Don't use both full and partial for the same action (they're mutually exclusive)</li>
                    <li>Common filter fields: <code>_submitted_by</code>, <code>organization</code>, <code>region</code></li>
                    <li><strong>Multiple filter values:</strong> Separate with commas: <code>org1,org2,org3</code></li>
                </ul>
            </div>

            <div>
                <h3 style="color: #2c3e50; font-size: 18px; margin: 15px 0 10px 0;">Template Columns (21 total)</h3>
                <div class="columns-grid">
                    <div class="column-item"><div class="column-name">username</div><div class="column-desc">KoboToolbox username</div></div>
                    <div class="column-item"><div class="column-name">view_form</div><div class="column-desc">View form design</div></div>
                    <div class="column-item"><div class="column-name">edit_form</div><div class="column-desc">Edit form design</div></div>
                    <div class="column-item"><div class="column-name">manage_project</div><div class="column-desc">Full project management</div></div>
                    <div class="column-item"><div class="column-name">add_submissions</div><div class="column-desc">Add new submissions</div></div>
                    <div class="column-item"><div class="column-name">view_submissions</div><div class="column-desc">View all submissions</div></div>
                    <div class="column-item"><div class="column-name">edit_submissions</div><div class="column-desc">Edit all submissions</div></div>
                    <div class="column-item"><div class="column-name">delete_submissions</div><div class="column-desc">Delete all submissions</div></div>
                    <div class="column-item"><div class="column-name">validate_submissions</div><div class="column-desc">Validate all submissions</div></div>
                    <div class="column-item"><div class="column-name">partial_view</div><div class="column-desc">View filtered submissions</div></div>
                    <div class="column-item"><div class="column-name">partial_view_filter_field</div><div class="column-desc">Filter field for view</div></div>
                    <div class="column-item"><div class="column-name">partial_view_filter_value</div><div class="column-desc">Filter value for view</div></div>
                    <div class="column-item"><div class="column-name">partial_edit</div><div class="column-desc">Edit filtered submissions</div></div>
                    <div class="column-item"><div class="column-name">partial_edit_filter_field</div><div class="column-desc">Filter field for edit</div></div>
                    <div class="column-item"><div class="column-name">partial_edit_filter_value</div><div class="column-desc">Filter value for edit</div></div>
                    <div class="column-item"><div class="column-name">partial_delete</div><div class="column-desc">Delete filtered submissions</div></div>
                    <div class="column-item"><div class="column-name">partial_delete_filter_field</div><div class="column-desc">Filter field for delete</div></div>
                    <div class="column-item"><div class="column-name">partial_delete_filter_value</div><div class="column-desc">Filter value for delete</div></div>
                    <div class="column-item"><div class="column-name">partial_validate</div><div class="column-desc">Validate filtered submissions</div></div>
                    <div class="column-item"><div class="column-name">partial_validate_filter_field</div><div class="column-desc">Filter field for validate</div></div>
                    <div class="column-item"><div class="column-name">partial_validate_filter_value</div><div class="column-desc">Filter value for validate</div></div>
                </div>
            </div>

            <div>
                <h3 style="color: #2c3e50; font-size: 18px; margin: 20px 0 10px 0;">Example Users in Template</h3>
                <div class="example-users">
                    <div class="example-user admin">
                        <div class="example-user-name">steve_kobo - Full Admin</div>
                        <div class="example-user-desc">Has all permissions to view, edit, manage, and validate everything</div>
                    </div>
                    <div class="example-user partial">
                        <div class="example-user-name">bob_kobo - Partial Access</div>
                        <div class="example-user-desc">Can view form and add submissions. Can view and validate only where organization=bar</div>
                    </div>
                    <div class="example-user viewer">
                        <div class="example-user-name">alice_viewer - Own Submissions Only</div>
                        <div class="example-user-desc">Can only view submissions she created (_submitted_by=alice_viewer)</div>
                    </div>
                </div>
            </div>
        </div>

        <h2>🚀 Update Permissions</h2>
        
        <form id="permissionForm">
            <div class="form-group">
                <label for="spreadsheetData">Spreadsheet Data *</label>
                <textarea id="spreadsheetData" required placeholder="Paste your data here..."></textarea>
                <div class="help-text">
                    Copy and paste from the downloaded template (Excel/Google Sheets)
                </div>
                <div class="example">Example (copy from template):
username	view_form	edit_form	manage_project	add_submissions	view_submissions...
steve_kobo	TRUE	TRUE	TRUE	TRUE	TRUE...</div>
            </div>

            <button type="submit" class="submit-btn">Update Permissions</button>
        </form>

        <div class="loading">
            <div class="spinner"></div>
            <p style="margin-top: 10px; color: #7f8c8d;">Processing...</p>
        </div>

        <div id="result" class="result"></div>
    </div>

    <script>
        function downloadTemplate() {
            window.location.href = '/download-template';
        }

        // Export permissions form handler
        document.getElementById('exportForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const token = document.getElementById('globalToken').value.trim();
            const baseUrl = document.getElementById('globalBaseUrl').value.trim();
            const assetUid = document.getElementById('globalAssetUid').value.trim();
            const owner = document.getElementById('globalOwner').value.trim();

            if (!token || !baseUrl || !assetUid) {
                alert('Please fill in the Configuration section (Token, Base URL, Asset UID)');
                return;
            }
            
            const resultDiv = document.getElementById('exportResult');
            const loadingDiv = document.getElementById('exportLoading');
            const submitBtn = document.querySelector('.export-btn');
            
            resultDiv.style.display = 'none';
            loadingDiv.style.display = 'block';
            submitBtn.disabled = true;
            
            try {
                const requestBody = {
                    token,
                    baseUrl,
                    assetUid
                };
                
                // Only include owner if provided
                if (owner) {
                    requestBody.owner = owner;
                }
                
                const response = await fetch('/api/export-permissions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });
                
                if (response.ok) {
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = \`kobo_permissions_\${assetUid}.tsv\`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    
                    const message = owner 
                        ? \`Permissions exported successfully (excluding owner: \${owner})!\`
                        : 'Permissions exported successfully!';
                    displayExportResults({ success: true, message: message }, true);
                } else {
                    const result = await response.json();
                    displayExportResults(result, false);
                }
                
            } catch (error) {
                displayExportResults({ error: error.message }, false);
            } finally {
                loadingDiv.style.display = 'none';
                submitBtn.disabled = false;
            }
        });

        // Update permissions form handler
        document.getElementById('permissionForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const token = document.getElementById('globalToken').value.trim();
            const baseUrl = document.getElementById('globalBaseUrl').value.trim();
            const assetUid = document.getElementById('globalAssetUid').value.trim();
            const owner = document.getElementById('globalOwner').value.trim();
            const spreadsheetData = document.getElementById('spreadsheetData').value.trim();
            
            if (!token || !baseUrl || !assetUid || !owner) {
                alert('Please fill in the Configuration section (Token, Base URL, Asset UID, Owner)');
                return;
            }

            const resultDiv = document.getElementById('result');
            const loadingDiv = document.querySelector('.loading');
            const submitBtn = document.querySelector('.submit-btn');
            
            resultDiv.style.display = 'none';
            loadingDiv.style.display = 'block';
            submitBtn.disabled = true;
            
            try {
                const users = parseSpreadsheetData(spreadsheetData);
                
                const response = await fetch('/api/update-permissions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token,
                        baseUrl,
                        assetUid,
                        owner,
                        users
                    })
                });
                
                const result = await response.json();
                displayResults(result, response.ok);
                
            } catch (error) {
                displayResults({ error: error.message }, false);
            } finally {
                loadingDiv.style.display = 'none';
                submitBtn.disabled = false;
            }
        });
        
        function parseSpreadsheetData(data) {
            const lines = data.trim().split('\\n');
            if (lines.length < 2) {
                throw new Error('Data must have at least a header row and one data row');
            }
            
            const headers = lines[0].split('\\t').map(h => h.trim());
            const requiredHeaders = ['username'];
            
            for (const required of requiredHeaders) {
                if (!headers.includes(required)) {
                    throw new Error('Missing required column: ' + required);
                }
            }
            
            const users = [];
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split('\\t');
                if (values.length !== headers.length) continue;
                
                const user = {};
                headers.forEach((header, index) => {
                    user[header] = values[index].trim();
                });
                
                users.push(user);
            }
            
            return users;
        }

        function displayExportResults(result, success) {
            const resultDiv = document.getElementById('exportResult');
            resultDiv.className = 'result ' + (success ? 'success' : 'error');
            resultDiv.style.display = 'block';
            
            if (success) {
                resultDiv.innerHTML = '<strong>✓ ' + (result.message || 'Export completed') + '</strong>';
            } else {
                resultDiv.innerHTML = '<strong>✗ Error:</strong> ' + (result.error || 'Unknown error occurred');
            }
        }
        
        function displayResults(result, success) {
            const resultDiv = document.getElementById('result');
            resultDiv.className = 'result ' + (success ? 'success' : 'error');
            resultDiv.style.display = 'block';
            
            if (success) {
                resultDiv.innerHTML = 
                    '<div class="result-header" onclick="toggleDetails()">' +
                        '<strong>✓ Permissions updated successfully!</strong>' +
                        '<span class="toggle-details">Show details</span>' +
                    '</div>' +
                    '<div class="result-details" id="resultDetails">' +
                        '<p style="margin-top: 10px;">' + (result.message || 'Update completed') + '</p>' +
                        '<pre>' + JSON.stringify(result, null, 2) + '</pre>' +
                    '</div>';
            } else {
                resultDiv.innerHTML = 
                    '<div class="result-header" onclick="toggleDetails()">' +
                        '<strong>✗ Error occurred</strong>' +
                        '<span class="toggle-details">Show details</span>' +
                    '</div>' +
                    '<div class="result-details" id="resultDetails">' +
                        '<p style="margin-top: 10px;">' + (result.error || 'Unknown error occurred') + '</p>' +
                        '<pre>' + JSON.stringify(result, null, 2) + '</pre>' +
                    '</div>';
            }
        }
        
        function toggleDetails() {
            const details = document.getElementById('resultDetails');
            const toggle = document.querySelector('.toggle-details');
            
            if (details.classList.contains('visible')) {
                details.classList.remove('visible');
                toggle.textContent = 'Show details';
            } else {
                details.classList.add('visible');
                toggle.textContent = 'Hide details';
            }
        }
    </script>
</body>
</html>
`;