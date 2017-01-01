angular.module('MoneyNetwork')
    
    .controller('UserCtrl', ['$scope', '$rootScope', '$timeout', 'MoneyNetworkService', '$location', function($scope, $rootScope, $timeout, moneyNetworkService, $location) {
        var self = this;
        var controller = 'UserCtrl';
        if (!MoneyNetworkHelper.getItem('userid')) return ; // not logged in - skip initialization of controller
        console.log(controller + ' loaded');

        self.user_info = moneyNetworkService.get_user_info() ; // array with tags and values from localStorage
        self.tags = moneyNetworkService.get_tags() ; // typeahead autocomplete functionality
        self.privacy_options = moneyNetworkService.get_privacy_options() ; // select options with privacy settings for user info
        self.show_privacy_title = moneyNetworkService.get_show_privacy_title() ; // checkbox - display column with privacy descriptions?

        // search for new ZeroNet contacts and add avatars for new contacts
        var contacts = moneyNetworkService.get_contacts(); // array with contacts from localStorage
        self.zeronet_search_contacts = function () {
            moneyNetworkService.z_contact_search(function () { $scope.$apply() }, null);
        };
        self.zeronet_search_contacts();

        function debug (key, text) {
            MoneyNetworkHelper.debug(key, text) ;
        }

        // quick instructions for newcomers
        self.show_welcome_msg = function () {
            if (!contacts) return true ;
            return (contacts.length == 0) ;
        }; // show_welcome_msg

        // add empty rows to user info table. triggered in privacy field. enter and tab (only for last row)
        self.insert_row = function(row) {
            var pgm = controller + '.insert_row: ' ;
            var index ;
            for (var i=0 ; i<self.user_info.length ; i++) if (self.user_info[i].$$hashKey == row.$$hashKey) index = i ;
            index = index + 1 ;
            self.user_info.splice(index, 0, moneyNetworkService.empty_user_info_line());
            $scope.$apply();
        };
        self.delete_row = function(row) {
            var pgm = controller + '.delete_row: ' ;
            var index ;
            for (var i=0 ; i<self.user_info.length ; i++) if (self.user_info[i].$$hashKey == row.$$hashKey) index = i ;
            // console.log(pgm + 'row = ' + JSON.stringify(row)) ;
            self.user_info.splice(index, 1);
            if (self.user_info.length == 0) self.user_info.splice(index, 0, moneyNetworkService.empty_user_info_line());
        };

        // user_info validations
        self.is_tag_required = function(row) {
            if (row.value) return true ;
            if (row.privary) return true ;
            return false ;
        };
        self.is_value_required = function(row) {
            if (!row.tag) return false ;
            if (row.tag == 'GPS') return false ;
            return true ;
        };
        self.is_privacy_required = function(row) {
            if (row.tag) return true ;
            if (row.value) return true ;
            return false ;
        };

        self.show_privacy_title_changed = function () {
            moneyNetworkService.set_show_privacy_title(self.show_privacy_title)
        };

        self.update_user_info = function () {
            var pgm = controller + '.update_user_info: ' ;
            // console.log(pgm + 'calling moneyNetworkService.save_user_info()');
            moneyNetworkService.save_user_info() ;
            // console.log(pgm) ;
        };
        self.revert_user_info = function () {
            var pgm = controller + '.revert_user_info: ' ;
            moneyNetworkService.load_user_info() ;
            // console.log(pgm) ;
        };

        // manage user avatar
        self.avatar = moneyNetworkService.get_avatar();
        // console.log(controller + ': self.avatar (1) = ' + JSON.stringify(self.avatar)) ;

        // upload_avatar callback function. handle upload
        function handleAvatarUpload (image_base64uri) {
            var ext, image_base64, user_path;
            if (!image_base64uri) return ;
            user_path = "data/users/" + ZeroFrame.site_info.auth_address ;
            ext = moneyNetworkService.get_image_ext_from_base64uri(image_base64uri);
            if (['png','jpg'].indexOf(ext) == -1) {
                ZeroFrame.cmd("wrapperNotification", ["error", "Sorry. Only png, jpg and jpeg images can be used as avatar", 5000]);
                return ;
            }
            ZeroFrame.cmd("fileDelete", user_path + "/avatar.jpg", function (res) {});
            ZeroFrame.cmd("fileDelete", user_path + "/avatar.png", function (res) {});
            image_base64 = image_base64uri != null ? image_base64uri.replace(/.*?,/, "") : void 0;
            ZeroFrame.cmd("fileWrite", [user_path + "/avatar." + ext, image_base64], function(res) {
                var pgm = controller + '.handleAvatarUpload fileWrite callback: ';
                // console.log(pgm + 'res = ' + JSON.stringify(res));
                self.avatar.src = user_path + "/avatar." + ext + '?rev=' + MoneyNetworkHelper.generate_random_password(10);
                $scope.$apply() ;
                moneyNetworkService.zeronet_site_publish() ;
                self.setup.avatar = ext ;
                moneyNetworkService.save_user_setup() ;
                //ZeroFrame.cmd("sitePublish", {inner_path: user_path + '/content.json'}, function (res) {
                //    // empty callback . no error handling. publish for avatar change is not important
                //}); // sitePublish
            }); // fileWrite
        } // handleAvatarUpload
        // avatar click using Uploadable class from ZeroMePlus
        self.upload_avatar = function () {
            var pgm = controller + '.upload_avatar: ';
            var uploadable_avatar = new Uploadable(handleAvatarUpload);
            uploadable_avatar.handleUploadClick() ;
        };

        // get setup with alias and spam settings
        function load_setup () {
            self.setup = moneyNetworkService.get_user_setup();
        }
        load_setup() ;
        function copy_setup() {
            self.setup_copy = JSON.parse(JSON.stringify(self.setup)) ;
        }
        copy_setup() ;

        // manage user alias
        self.editing_alias = false ;
        var edit_alias_notifications = 1 ;
        self.edit_alias = function () {
            self.editing_alias = true;
            if (edit_alias_notifications > 0) {
                ZeroFrame.cmd("wrapperNotification", ["info", "Edit alias. Press ENTER to save. Press ESC to cancel", 5000]);
                edit_alias_notifications--;
            }
            var set_focus = function () {
                document.getElementById('alias_id').focus()
            };
            $timeout(set_focus);
        };
        self.save_alias = function () {
            self.editing_alias = false ;
            self.setup.alias = self.setup_copy.alias ;
            moneyNetworkService.save_user_setup() ;
            copy_setup() ;
            $scope.$apply() ;
        };
        self.cancel_edit_alias = function () {
            self.editing_alias = false ;
            copy_setup();
            $scope.$apply() ;
        };

        // manage spam filter settings: block messages from guests and/or list of ignored contacts
        self.spam_settings_changed = function () {
            var pgm = controller + '.spam_settings_changed: ' ;
            if (self.setup_copy.block_guests != self.setup.block_guests) self.setup.block_guests_at = new Date().getTime() ;
            if (self.setup_copy.block_ignored != self.setup.block_ignored) self.setup.block_ignored_at = new Date().getTime() ;
            moneyNetworkService.save_user_setup() ;
            // console.log(pgm + 'setup = ' + JSON.stringify(self.setup));
            //setup = {
            //    ...
            //    "block_guests": false,
            //    "block_ignored": false,
            //    "block_guests_at": 1479033958082,
            //    "block_ignored_at": 1479033949514
            //};
            copy_setup() ;
        };

        function testcase_message_lost_in_cyberspace() {
            var pgm = controller + '.testcase_message_lost_in_cyberspace: ' ;
            var last_sent_at, last_contact, i, contact, j, message ;
            // insert test data for message lost in cyberspace testcase
            // create outbox message with local_msg_seq 999, status sent, not on zeronet (cleanup) and no feedback from contact
            // next outbox message will request feedback info for message lost in cyberspace
            last_sent_at = 0 ;
            last_contact = null ;
            for (i=0 ; i<contacts.length ; i++) {
                contact = contacts[i] ;
                if (!contact.messages) continue ;
                for (j=0 ; j<contact.messages.length ; j++) {
                    message = contact.messages[j] ;
                    if (message.folder != 'outbox') continue ;
                    if (message.sent_at < last_sent_at) continue ;
                    last_contact = contact ;
                    last_sent_at = message.sent_at ;
                }
            }
            if (!last_contact) {
                ZeroFrame.cmd('wrapperNotification', ['error', 'No last outbox message was found. cannot create message lost in cyberspace testcase', 5000]) ;
                return ;
            }
            // create test data. status sent, no zeronet_msg_id and status cleanup
            var local_msg_seq, sender_sha256, lost_message_with_envelope, js_messages ;
            local_msg_seq = moneyNetworkService.next_local_msg_seq() ;
            sender_sha256 = CryptoJS.SHA256(MoneyNetworkHelper.generate_random_password(200)).toString();
            lost_message_with_envelope =
            {
                "folder": "outbox",
                "message": {"msgtype": "chat msg", "message": "message " + local_msg_seq + " lost in cyberspace"},
                "local_msg_seq": local_msg_seq,
                "sender_sha256": sender_sha256,
                "sent_at": new Date().getTime(),
                "cleanup_at": new Date().getTime()
            } ;
            lost_message_with_envelope.ls_msg_size = JSON.stringify(lost_message_with_envelope).length ;
            debug('lost_message', pgm + 'lost_message = ' + JSON.stringify(lost_message_with_envelope));
            // add message
            moneyNetworkService.add_message(last_contact, lost_message_with_envelope) ;
            moneyNetworkService.ls_save_contacts(false) ;
            ZeroFrame.cmd('wrapperNotification', ['info', 'created new outbox msg ' + local_msg_seq + '. Not sent, not on ZeroNet, no feedback info and marked as cleanup', 5000]);
        } // testcase_message_lost_in_cyberspace

        self.debug_settings_changed = function () {
            // create test data
            var old_force_lost_message = self.setup_copy.test && self.setup_copy.test.force_lost_message ;
            var new_force_lost_message = self.setup.test && self.setup.test.force_lost_message ;
            if (!old_force_lost_message && new_force_lost_message) testcase_message_lost_in_cyberspace() ;
            if (self.setup.encryption != self.setup_copy.encryption) {
                ZeroFrame.cmd('wrapperNotification', ['info', 'Preferred encryption was changed.<br>Save user information or send a new message to publish change to peers', 5000]);
            }

            copy_setup() ;
            moneyNetworkService.save_user_setup() ;
            MoneyNetworkHelper.load_user_setup() ;
        };

        if (self.setup.guest) self.guest_password = MoneyNetworkHelper.getItem('password') ;

        // find JSEncrypt keysize. Used in mouse over title
        self.keysize = 2048 ;
        (function(){
            var encrypt = new JSEncrypt();
            encrypt.setPublicKey(MoneyNetworkHelper.getItem('pubkey'));
            self.keysize = encrypt.key.n.bitLength() ;
        })() ;

        // deep chat link
        self.my_chat_url = $location.protocol() + '://' + $location.host() + ':' + $location.port() + '/moneynetwork.bit/?path=/chat2/' + ZeroFrame.site_info.cert_user_id ;
        // console.log(controller + ': my_chat_url = ' + self.my_chat_url) ;

        ZeroFrame.cmd("wrapperReplaceState", [{"scrollY": 100}, "Account", "?path=/user"]) ;

        // admin link section

        // soft delete current user account
        self.delete_user2 = function(all_accounts) {
            var pgm = controller + '.delete_user2: ' ;
            var passwords, i, no_local_accounts, pubkey, current_cert_user_id, cert_user_ids, contact, text;

            // number local accounts. has other local user accounts been created including guest accounts?
            passwords = JSON.parse(MoneyNetworkHelper.getItem('passwords')) ;
            no_local_accounts = 0 ;
            for (i=0 ; i<passwords.length ; i++) if (passwords[i]) no_local_accounts++ ;

            // has current user other ZeroNet accounts?
            // number of ZeroNet accounts with identical pubkey
            pubkey = MoneyNetworkHelper.getItem('pubkey') ;
            current_cert_user_id = ZeroFrame.site_info.cert_user_id ;
            contacts = moneyNetworkService.get_contacts() ;
            cert_user_ids = [] ;
            for (i=0 ; i<contacts.length ; i++) {
                contact = contacts[i] ;
                if (contact.pubkey != pubkey) continue ;
                if (contact.cert_user_id == current_cert_user_id) continue ;
                cert_user_ids.push(contact.cert_user_id) ;
            }
            console.log(pgm + 'no_local_accounts = ' + no_local_accounts + ', cert_user_ids = ' + cert_user_ids.join(', '));

            // delete account text. multiple ZeroNet accounts and/or multiple local accounts warnings
            text = 'Delete ZeroNet data for ' + current_cert_user_id + ' and local data' ;
            if ((no_local_accounts > 1) && !all_accounts) text += '  for this account' ;
            text += '?' ;
            if (cert_user_ids.length) text +=
                '<br>Note that you also have data stored under ZeroNet certificate ' + cert_user_ids.join(', ') +
                '<br>You may after delete wish to change ZeroNet certificate, log in again and delete the other data too' ;
            if (no_local_accounts > 1) {
                text +=
                    '<br>Local browser data for ' + (no_local_accounts-1) + ' other account' +
                    ((no_local_accounts-1) > 1 ? 's' : '') + ' will' ;
                if (!all_accounts) text += ' not' ;
                text += ' be deleted' ;
            }
            text += '<br>Delete account and data?' ;

            ZeroFrame.cmd("wrapperConfirm", [text, "OK"], function (confirm) {
                var pgm = controller + '.delete_user2 wrapperConfirm callback 1: ' ;
                var user_path ;
                if (!confirm) return ;
                user_path = "data/users/" + ZeroFrame.site_info.auth_address;
                var my_auth_address = ZeroFrame.site_info.auth_address ;

                // delete confirmed. delete user process:
                // 1) delete all downloaded optional files from other users
                // 2) overwrite all uploaded optional files with empty jsons
                // 3) delete user files from zeroNet (data.json, status.json, avatar.jpg, avatar.png)
                // 4) delete data from localStorage
                // 5) delete user from sessionStorage

                // create callbacks for cleanup operation



                // update/delete status.json helpers



                var logout_and_redirect = function () {
                    var text, a_path, z_path;
                    // done. log out, notification and redirect
                    moneyNetworkService.client_logout();
                    no_local_accounts--;
                    text = 'Your money network account has been deleted';
                    if (no_local_accounts == 1) text += '<br>There is one other local account in this browser';
                    if (no_local_accounts > 1) text += '<br>There is ' + no_local_accounts + ' other local accounts in this browser';
                    if (cert_user_ids.length == 1) text += '<br>Data on ZeroNet account ' + cert_user_ids[0] + ' has not been deleted';
                    if (cert_user_ids.length > 1) text += '<br>Data on ZeroNet accounts ' + cert_user_ids.join(', ') + ' has not been deleted';
                    ZeroFrame.cmd("wrapperNotification", ['info', text]);
                    // redirect
                    a_path = '/auth';
                    z_path = "?path=" + a_path;
                    $location.path(a_path);
                    $location.replace();
                    ZeroFrame.cmd("wrapperReplaceState", [{"scrollY": 100}, "Log in", z_path]);
                    $scope.$apply();

                }; // logout_and_redirect

                var cleanup_localstorage = function () {
                    var pgm = controller + '.delete_user2 cleanup_localstorage callback: ' ;
                    // delete all localStorage data for this user.
                    if ((no_local_accounts == 1) || all_accounts) {
                        // only/last local account - simple localStorage overwrite
                        MoneyNetworkHelper.ls_clear();
                    }
                    else {
                        // remove user data
                        MoneyNetworkHelper.removeItem('contacts');
                        MoneyNetworkHelper.removeItem('user_info');
                        MoneyNetworkHelper.removeItem('msg_seq');
                        MoneyNetworkHelper.removeItem('avatar');
                        MoneyNetworkHelper.removeItem('alias');
                        MoneyNetworkHelper.removeItem('setup');
                        // remove account
                        MoneyNetworkHelper.removeItem('pubkey2');
                        MoneyNetworkHelper.removeItem('pubkey');
                        MoneyNetworkHelper.removeItem('prvkey');
                        MoneyNetworkHelper.removeItem('key');
                        // null password
                        user_id = moneyNetworkService.get_user_id() ;
                        passwords[user_id-1] = null ;
                        MoneyNetworkHelper.setItem('passwords', JSON.stringify(passwords)) ;
                        MoneyNetworkHelper.ls_save() ;
                    }
                }; // cleanup_localstorage

                var publish = function () {
                    ZeroFrame.cmd("sitePublish", {inner_path: user_path + '/content.json'}, function (res) {
                        var pgm = controller + '.delete_user2 sitePublish callback: ' ;
                        console.log(pgm + 'res = ' + JSON.stringify(res)) ;
                        cleanup_localstorage() ;
                        logout_and_redirect();
                    })
                }; // publish


                var delete_status_json = function () {
                    ZeroFrame.cmd("fileDelete", user_path + '/' + 'status.json', function (res) {
                        var pgm = controller + '.delete_user2 fileDelete status.json callback: ' ;
                        console.log(pgm + 'res = ' + JSON.stringify(res)) ;
                        publish();
                    }) ;
                };
                var update_status_json = function (my_user_seq) {
                    ZeroFrame.cmd("fileGet", [user_path + '/' + 'status.json', false], function (status) {
                        var pgm = controller + '.delete_user2 fileGet status.json callback : ' ;
                        var i, json_raw ;
                        if (!status) { publish() ; return }
                        status = JSON.parse(status) ;
                        if (!status.status) status.status = [] ;
                        for (i=status.status.length-1 ; i >= 0 ; i--) if (status.status[i].user_seq == my_user_seq) status.status.splice(i,1);
                        if (status.status.length == 0) {
                            // no more data. simple data
                            delete_status_json() ;
                            return ;
                        }
                        json_raw = unescape(encodeURIComponent(JSON.stringify(status, null, "\t")));
                        ZeroFrame.cmd("fileWrite", [user_path + '/' + 'status.json', btoa(json_raw)], function (res) {
                            var pgm = controller + '.delete_user2 fileWrite status.json callback : ' ;
                            console.log(pgm + 'res = ' + JSON.stringify(res)) ;
                            publish() ;
                        }) ;
                    }) ; // fileGet callback

                }; // update_delete_status_json

                var update_or_delete_status_json = function (my_user_seq) {
                    if (all_accounts) delete_status_json() ;
                    else update_status_json(my_user_seq) ;
                }; // update_or_delete_status_json

                var delete_data_json = function (user_seq) {
                    ZeroFrame.cmd("fileDelete", user_path + '/' + 'data.json', function (res) {
                        var pgm = controller + '.delete_user2 fileDelete data.json callback: ' ;
                        console.log(pgm + 'res = ' + JSON.stringify(res)) ;
                        update_or_delete_status_json(user_seq);
                    }) ;
                };

                // update/delete data.json helpers
                var update_data_json = function (my_user_seq) {
                    ZeroFrame.cmd("fileGet", [user_path + '/' + 'data.json', false], function (data) {
                        var pgm = controller + '.delete_user2 fileGet data.json callback: ' ;
                        var i, json_raw ;
                        if (!data) { update_or_delete_status_json(user_seq) ; return }
                        data = JSON.parse(data) ;
                        if (!data.users) data.users = [] ;
                        for (i=data.users.length-1 ; i >= 0 ; i--) if (data.users[i].user_seq == my_user_seq) data.users.splice(i,1);
                        if (!data.search) data.search = [] ;
                        for (i=data.search.length-1 ; i >= 0 ; i--) if (data.search[i].user_seq == my_user_seq) data.search.splice(i,1);
                        if (!data.msg) data.msg = [] ;
                        for (i=data.msg.length-1 ; i >= 0 ; i--) if (data.msg[i].user_seq == my_user_seq) data.msg.splice(i,1);
                        if ((data.users.length == 0) && (data.search.length == 0) && (data.msg.length == 0)) {
                            // no more data. simple data
                            delete_data_json(my_user_seq) ;
                            return ;
                        }
                        json_raw = unescape(encodeURIComponent(JSON.stringify(data, null, "\t")));
                        ZeroFrame.cmd("fileWrite", [user_path + '/' + 'data.json', btoa(json_raw)], function (res) {
                            var pgm = controller + '.delete_user2 fileWrite data.json callback: ' ;
                            console.log(pgm + 'res = ' + JSON.stringify(res)) ;
                            update_or_delete_status_json(my_user_seq) ;
                        }) ;
                    }) ; // fileGet callback

                }; // update_delete_data_json

                var update_or_delete_data_json = function (my_user_seq) {
                    if (all_accounts) delete_data_json(my_user_seq) ;
                    else update_data_json(my_user_seq) ;

                }; // update_or_delete_data_json

                // 1) delete all downloaded optional files from other users
                // 2) overwrite all uploaded optional files with empty jsons
                var cleanup_optional_files = function (my_user_seq) {
                    ZeroFrame.cmd("optionalFileList", { limit: 99999}, function (list) {
                        var pgm = controller + '.delete_user2 optionalFileList callback 3: ';
                        var i, file_auth_address, file_user_seq, inner_path, empty_json, empty_json_raw, user_path,
                            a_path, z_path;
                        // console.log(pgm + 'list = ' + JSON.stringify(list)) ;
                        empty_json = {};
                        empty_json_raw = unescape(encodeURIComponent(JSON.stringify(empty_json, null, "\t")));
                        for (i = 0; i < list.length; i++) {
                            inner_path = list[i].inner_path;
                            file_auth_address = inner_path.split('/')[2];
                            file_user_seq = parseInt(inner_path.split('-')[2]);
                            if ((file_auth_address == my_auth_address) && ((file_user_seq == my_user_seq) || all_accounts)) {
                                // overwrite uploaded optional file with empty json.
                                // empty json will be distributed to other ZeroNet users before physical delete
                                ZeroFrame.cmd("fileWrite", [inner_path, btoa(empty_json_raw)], function () {
                                });
                            }
                            else if (file_auth_address == my_auth_address) {
                                // keep uploaded optional file. from this ZeroNet account but from an other local account
                            }
                            else {
                                // delete downloaded optional file from user zeronet accounts. maybe already done
                                ZeroFrame.cmd("optionalFileDelete", {inner_path: inner_path}, function () {
                                });
                            }
                        } // for i

                        update_or_delete_data_json(my_user_seq) ;
                    }) ;
                } ; // cleanup_optional_files

                // run all callbacks for cleanup operation
                if (all_accounts) {
                    ZeroFrame.cmd("fileDelete", user_path + '/' + 'avatar.jpg', function () {}) ;
                    ZeroFrame.cmd("fileDelete", user_path + '/' + 'avatar.png', function () {}) ;
                }
                moneyNetworkService.get_user_seq(function (my_user_seq) {
                    cleanup_optional_files(my_user_seq);
                }) ;

            }) ; // wrapperConfirm callback 1

        }; // delete_user2

        // end UserCtrl
    }])

;
