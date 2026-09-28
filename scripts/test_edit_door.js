const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Setup mock window/root
global.window = {};
global.document = {
    createElement: () => {
        const el = {
            style: {},
            children: [],
            appendChild: function(c) { this.children.push(c); },
            addEventListener: () => {},
            removeChild: () => {},
            innerHTML: '',
            querySelector: function(sel) { 
                if (this.children.length > 0) return this.children[0]; 
                return { addEventListener: () => {}, value: 'mock', querySelector: () => ({ addEventListener: () => {}, value: 'mock' }) };
            }
        };
        return el;
    },
    dispatchEvent: () => {},
    body: { appendChild: () => {} }
};

// Load dependencies
function loadModule(filename) {
    const code = fs.readFileSync(path.join(__dirname, '..', filename), 'utf8');
    eval(code);
}

loadModule('data_model.js');
global.DataModel = window.DataModel;
global.generateUUIDv7 = window.generateUUIDv7;

loadModule('data_store.js');
global.DataStore = window.DataStore;

loadModule('type_catalogue.js');
global.TYPE_CATALOGUE = window.TYPE_CATALOGUE;

const EditDoor = require('../edit_door.js');

console.log('Running EditDoor Test Suite...');
let passed = 0;
let total = 0;

function runTest(name, fn) {
    total++;
    try {
        fn();
        passed++;
        console.log(`[PASS] ${name}`);
    } catch (e) {
        console.error(`[FAIL] ${name}`);
        console.error(e);
    }
}

const mockStorage = {
    getItem: () => null,
    setItem: () => {}
};

// 1. Test Door 1: Field Discrepancy
runTest('Door 1: Creates FieldRecord and auto-Query on significant discrepancy', () => {
    const store = new DataStore(mockStorage);
    store.fieldRecords = [];
    store.queries = {};
    store.localDesignVersions = {};
    store.changeSets = {};
    
    const container = { appendChild: () => {}, querySelector: () => ({}) };
    const editDoor = new EditDoor(container, store);
    
    editDoor.openFieldDiscrepancy({ feature_id: 'feat-123', type: 'T1', ch_start: 85200 });
    
    // Simulate user interaction via mocking DOM state isn't trivial, but we can call the core logic or simulate the save directly.
    // To test effectively, we can mock the values right before the listener triggers.
    const modalContent = editDoor.modalEl.querySelector('.di-modal-content');
    
    // Override values
    modalContent.querySelector = (sel) => {
        if (sel === '.close-btn') return { addEventListener: () => {} };
        if (sel === '#door1-save') return { 
            addEventListener: (ev, cb) => {
                // Call callback immediately with fake values
                setTimeout(() => {
                    modalContent.querySelector = (innerSel) => {
                        if (innerSel === '#door1-type') return { value: 'T7' };
                        if (innerSel === '#door1-ch') return { value: '85210' }; // 10m off
                        if (innerSel === '#door1-severity') return { value: 'Major' };
                        if (innerSel === '#door1-notes') return { value: 'Contractor changed it' };
                        return { addEventListener: () => {} };
                    };
                    cb();
                }, 0);
            } 
        };
        return { value: '' };
    };
    
    // Re-render to bind our fake
    editDoor._renderDoor1({ feature_id: 'feat-123', type: 'T1', ch_start: 85200 });
    
    // We trigger the click logic
    const saveBtn = modalContent.querySelector('#door1-save');
    saveBtn.addEventListener('click', () => {}); // Will trigger our timeout
    
    setTimeout(() => {
        assert(store.fieldRecords.length >= 2, 'Should create as_built_type and as_built_position records');
        
        const typeRec = store.fieldRecords.find(r => r.kind === 'as_built_type');
        assert(typeRec, 'as_built_type record created');
        assert.strictEqual(typeRec.payload.built_type, 'T7');
        
        const posRec = store.fieldRecords.find(r => r.kind === 'as_built_position');
        assert(posRec, 'as_built_position record created');
        assert.strictEqual(posRec.payload.built_ch, 85210);
        
        const queries = Object.values(store.queries);
        assert(queries.length > 0, 'Should auto-create a Query');
        assert.strictEqual(queries[0].feature_id, 'feat-123');
        assert(['wrong_type', 'misplaced'].includes(queries[0].reason), 'Query reason is correct');
    }, 10);
});

// 2. Test Door 2: Design Revision
runTest('Door 2: Creates DesignVersion and ChangeSet', () => {
    const store = new DataStore(mockStorage);
    store.fieldRecords = [];
    store.queries = {};
    store.localDesignVersions = {};
    store.changeSets = {};
    
    const container = { appendChild: () => {}, querySelector: () => ({}) };
    const editDoor = new EditDoor(container, store);
    
    editDoor.openDesignRevision({ feature_id: 'feat-999', type: 'T1', ch_start: 10000, version: 1 });
    
    const modalContent = editDoor.modalEl.querySelector('.di-modal-content');
    
    modalContent.querySelector = (sel) => {
        if (sel === '.close-btn') return { addEventListener: () => {} };
        if (sel === '#door2-save') return {
            addEventListener: (ev, cb) => {
                setTimeout(() => {
                    modalContent.querySelector = (innerSel) => {
                        if (innerSel === '#door2-source') return { value: 'site_instruction' };
                        if (innerSel === '#door2-ref') return { value: 'SI-047' };
                        if (innerSel === '#door2-type') return { value: 'T12' };
                        return { addEventListener: () => {} };
                    };
                    cb();
                }, 0);
            }
        };
        return { value: '' };
    };
    
    editDoor._renderDoor2({ feature_id: 'feat-999', type: 'T1', ch_start: 10000, version: 1 });
    
    const saveBtn = modalContent.querySelector('#door2-save');
    saveBtn.addEventListener('click', () => {});
    
    setTimeout(() => {
        assert(store.localDesignVersions, 'DesignVersions dict created');
        const dvs = Object.values(store.localDesignVersions);
        assert.strictEqual(dvs.length, 1, 'Should create 1 DesignVersion');
        assert.strictEqual(dvs[0].feature_id, 'feat-999');
        assert.strictEqual(dvs[0].version, 2);
        assert.strictEqual(dvs[0].source.doc_ref, 'SI-047');
        
        assert(store.changeSets, 'ChangeSets dict created');
        const css = Object.values(store.changeSets);
        assert.strictEqual(css.length, 1, 'Should create 1 ChangeSet');
        assert.strictEqual(css[0].source.doc_ref, 'SI-047');
    }, 10);
});

// Run async tests
setTimeout(() => {
    console.log(`\nTests Completed: ${passed}/${total} passed`);
    if (passed !== total) process.exit(1);
}, 100);
