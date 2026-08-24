# 2026-08-24 10:15:42 by RouterOS 7.14.3
# software id = LAB0-TEST
#
# model = RB3011UiAS
# serial number = LAB000000001
/interface bridge
add name=bridge-lan
/ip pool
add name=lab-pppoe-pool ranges=10.20.30.10-10.20.30.254
add name=lab-hotspot-pool ranges=10.20.50.10-10.20.50.254
/ppp profile
set *0 name=default
set *FFFFFFFE name=default-encryption
add local-address=10.20.30.1 name=HOME-2M rate-limit="2M/2M" remote-address=lab-pppoe-pool
add local-address=10.20.30.1 name=HOME-5M rate-limit="5M/5M" remote-address=lab-pppoe-pool
add local-address=10.20.30.1 name=HOME-10M rate-limit="3M/10M" remote-address=lab-pppoe-pool
add local-address=10.20.30.1 name=BIZ-20M rate-limit="10M/20M 12M/24M 8M/16M 30/30 8" remote-address=lab-pppoe-pool
add local-address=10.20.30.1 name=staff-unmetered remote-address=lab-pppoe-pool
/ip hotspot user profile
set [ find default=yes ] name=default
add name=HS-DAY rate-limit=3M/3M shared-users=2
add name=HS-WEEK rate-limit=5M/5M shared-users=4
/ppp secret
add name="acct_1000" password="p@ss807!" profile=BIZ-20M service=pppoe comment="Mercy Kiprop 0781586306 exp 2026-10-25"
add name="acct_1001" password="nancy65" profile=HOME-10M service=pppoe comment="Alice Wairimu - 0734469331"
add name="lucy.maina" password="p@ss470!" profile=BIZ-20M service=pppoe comment="Lucy Maina 0707500941 paid till 7 Sep 2026"
add name="victor.omondi" password="p@ss948!" profile=HOME-10M service=pppoe remote-address=10.20.30.103 comment="Victor Omondi - 0738160665"
add name="0741001982" password="p@ss180!" profile=HOME-5M service=pppoe disabled=yes comment="David Achieng 0741001982 exp 2026-10-01"
add name="beatrice.cherono" password="beatrice37" profile=HOME-10M service=pppoe comment="Beatrice Cherono 0725218494 exp 2026-10-03"
add name="mercy.barasa" password="p@ss704!" profile=BIZ-20M service=pppoe comment="Mercy Barasa | 0733537519 | due 8/9/2026"
add name="kevin.omondi" password="david29" profile=HOME-5M service=pppoe comment="Kevin Omondi - 0783490199"
add name="acct_1008" password="patrick59" profile=HOME-2M service=pppoe comment="Joyce Mwangi 0706167821 exp 2026-09-01"
add name="0702373192" password="green 488" profile=HOME-2M service=pppoe comment="Erick Mwangi 0702373192 exp 2026-09-11"
add name="purity.omondi" password="net3007" profile=HOME-5M service=pppoe comment="Purity Omondi - 0704916191"
add name="acct_1011" password="janet63" profile=BIZ-20M service=pppoe comment="John Achieng | 0782869830 | due 21/9/2026"
add name="acct_1012" password="janet98" profile=HOME-2M service=pppoe comment="Peter Kamau 0748523973 exp 2026-09-02"
add name="0706559372" password="fiber9855" profile=HOME-10M service=pppoe disabled=yes comment="Nancy Barasa 0706559372 paid till 16 Sep 2026"
add name="purity.cherono" password="p@ss346!" profile=HOME-10M service=pppoe remote-address=10.20.30.114 comment="Purity Cherono 0792484680 exp 2026-10-02"
add name="acct_1015" password="green 636" profile=HOME-10M service=pppoe comment="Collins Cherono 0739401294 paid till 14 Sep 2026"
add name="kevin.maina" password="collins83" profile=BIZ-20M service=pppoe comment="Kevin Maina 0797800654 paid till 2 Sep 2026"
add name="brian.mutua" password="256433" profile=BIZ-20M service=pppoe comment="Brian Mutua | 0706301217 | due 20/10/2026"
add name="acct_1018" password="p@ss490!" profile=HOME-10M service=pppoe comment="Nancy Wangari 0786447691 paid till 8 Sep 2026"
add name="acct_1019" password="355296" profile=HOME-2M service=pppoe comment="Lucy Akinyi - 0787393601"
add name="acct_1020" password="p@ss708!" profile=HOME-10M service=pppoe comment="Victor Chebet - 0784417323"
add name="0731415115" password="p@ss381!" profile=HOME-10M service=pppoe comment="Rose Chebet 0731415115 paid till 5 Sep 2026"
add name="brian.barasa" password="lucy43" profile=HOME-10M service=pppoe disabled=yes comment="Brian Barasa - 0735996106"
add name="dennis.omondi" password="p@ss919!" profile=HOME-2M service=pppoe comment="Dennis Omondi - 0791033657"
add name="victor.maina" password="felix16" profile=HOME-2M service=pppoe comment="Victor Maina - 0796472778"
add name="acct_1025" password="blue 196" profile=HOME-10M service=pppoe remote-address=10.20.30.125 comment="Peter Mutua | 0701264054 | due 21/10/2026"
add name="david.wafula" password="892115" profile=BIZ-20M service=pppoe comment="David Wafula 0791355885 2026-09-01"
add name="acct_1027" password="wifi3961" profile=HOME-10M service=pppoe comment="Joseph Wanjiku | 0733871417 | due 8/10/2026"
add name="acct_1028" password="fiber7154" profile=HOME-2M service=pppoe comment="Nancy Mwangi 0732250800 exp 2026-10-21"
add name="beatrice.njoroge" password="simon11" profile=BIZ-20M service=pppoe comment="Beatrice Njoroge 0732987046 exp 2026-09-11"
add name="joyce.wanjiku" password="fiber1863" profile=BIZ-20M service=pppoe comment="Joyce Wanjiku 0796681096 exp 2026-09-21"
add name="acct_1031" password="net6129" profile=HOME-5M service=pppoe disabled=yes comment="Beatrice Kiprop | 0785357795 | due 25/9/2026"
add name="0748860748" password="esther23" profile=HOME-5M service=pppoe comment="David Omondi 0748860748 2026-09-13"
add name="acct_1033" password="janet65" profile=HOME-10M service=pppoe comment="Erick Adhiambo 0715871045 exp 2026-10-03"
add name="noc.staff" password="noc 4477" profile=staff-unmetered service=pppoe comment="NOC laptop - do not bill"
add name="acct_9001" password="fiber2211" profile=HOME-5M service=pppoe
/ip hotspot user
add name=default-trial profile=default
add name="kiosk01" password="kiosk123" profile=HS-DAY comment="Cyber kiosk Ruiru 0722004455 exp 2026-09-30"
add name="kiosk02" password="kiosk456" profile=HS-DAY comment="Cyber kiosk Kimbo 0733005566"
add name="lodge-wifi" password="lodge2026" profile=HS-WEEK comment="Green Lodge 0711223344 due 20/09/2026"
add name="salon01" password="salon77" profile=HS-DAY comment="Beauty Spot 0700998877"
add name="church-hall" password="hall 2026" profile=HS-WEEK comment="St Marks hall 0722334455 paid till 5 Oct 2026"
add mac-address=AA:BB:CC:11:22:33 profile=HS-DAY comment="Reception tablet"
/queue simple
add max-limit=4M/4M name="shop-corner" target=10.20.40.11/32 comment="Corner shop static 0722667788 exp 2026-09-18"
add max-limit=8M/8M name="flats-blockB" target=10.20.40.12/32 comment="Block B landlord 0733778899"
add max-limit=15M/15M name="school-lab" target=10.20.40.13/32 comment="Ruiru school lab due 1/10/2026"
/interface pppoe-server server
add default-profile=HOME-5M disabled=no interface=ether2 service-name=lab-isp
/system script
add name=centipede-sync source=":log info \"centipede sync\""
/system scheduler
add interval=1d name=centipede-expiry on-event="/ppp secret set [find comment~\"exp\"] disabled=yes" start-time=00:05 comment="centipede nightly expiry sweep"
/radius
add address=192.168.88.250 comment="centipede radius" disabled=yes secret=centipede-secret service=ppp
/ppp aaa
set accounting=yes use-radius=no
/ip firewall filter
add action=fasttrack-connection chain=forward comment="defconf: fasttrack" connection-state=established,related
/system identity
set name=RUIRU-CORE-01
