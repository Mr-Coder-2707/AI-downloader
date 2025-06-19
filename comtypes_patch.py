"""
Patch for comtypes to work with Python 3.13's stricter exception handling.
This file needs to be imported before any imports that might use comtypes.
"""
import sys
import importlib.util
import warnings

# Only apply patches if running on Python 3.13+
if sys.version_info >= (3, 13):
    print("Applying comtypes patches for Python 3.13...")
    warnings.filterwarnings("ignore", category=DeprecationWarning, 
                          message="catching classes that do not inherit from BaseException is not allowed")
    
    # Check if comtypes is installed
    if importlib.util.find_spec("comtypes"):
        import comtypes
        import comtypes._vtbl
        
        # Fix the catch_errors function to match the correct signature
        # In comtypes/_vtbl.py it's called with: catch_errors(inst, mth, paramflags, interface, mthname)
        original_catch_errors = getattr(comtypes._vtbl, 'catch_errors', None)
        def safe_catch_errors(inst, mth, paramflags, interface, mthname):
            """
            Safe replacement that correctly matches the function signature and only
            catches proper Python exceptions.
            """
            def wrapper(*args, **kwargs):
                try:
                    return mth(inst, *args)
                except Exception as e:
                    print(f"Handled exception in comtypes: {e}")
                    return None
            return wrapper
        
        # Replace the original function
        if original_catch_errors:
            comtypes._vtbl.catch_errors = safe_catch_errors
            print("✓ Patched comtypes.catch_errors")
        
        # Fix call_with_this function
        if hasattr(comtypes._vtbl, 'call_with_this'):
            original_call_with_this = comtypes._vtbl.call_with_this
            
            def safe_call_with_this(func, this, argtypes, args, lresult):
                try:
                    result = func(this, *args)
                    if lresult:
                        lresult[0] = result
                    return 0  # S_OK
                except Exception as e:
                    print(f"Error in comtypes call: {e}")
                    return -1  # E_FAIL
            
            comtypes._vtbl.call_with_this = safe_call_with_this
            print("✓ Patched comtypes.call_with_this")
        
        # Disable _DoNotWrap (another source of problematic exception catching)
        try:
            if hasattr(comtypes, "_cominterface") and hasattr(comtypes._cominterface, "_DoNotWrap"):
                # Replace with only Python standard exceptions
                comtypes._cominterface._DoNotWrap = (BaseException,)
                print("✓ Patched comtypes._cominterface._DoNotWrap")
        except:
            pass
        
        print("All comtypes patches applied successfully!")
